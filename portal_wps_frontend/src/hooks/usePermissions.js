import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../lib/api'

// Mapeamento de permissões
const PERMISSION_TYPES = {
  EDITOR: 'editor',
  VIEWER: 'viewer',
  NONE: 'none'
}

const PERMISSION_HIERARCHY = {
  [PERMISSION_TYPES.NONE]: 0,
  [PERMISSION_TYPES.VIEWER]: 1,
  [PERMISSION_TYPES.EDITOR]: 2
}

/**
 * Hook para verificar permissões do usuário atual
 */
const usePermissions = (user) => {
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setPermissions({})
      setLoading(false)
      return
    }

    if (user?.role === 'admin') {
      // Admin sempre tem todas as permissões
      setPermissions({})
      setLoading(false)
      return
    }

    const loadPermissions = async () => {
      try {
        setLoading(true)
        // Para admin, buscar todas as permissões; para outros, buscar apenas as do seu role
        const data = user?.role === 'admin' 
          ? await adminAPI.getPermissions()
          : await adminAPI.getMyPermissions()
        
        setPermissions(data || {})
      } catch (err) {
        setPermissions({})
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [user?.id, user?.role, user?.email])

  /**
   * Verifica se o usuário tem permissão para uma funcionalidade
   * 
   * REGRA DE NEGÓCIO:
   * - Admin sempre tem acesso completo (bypass)
   * - Editor (permission_type='editor') tem EXATAMENTE os mesmos privilégios que Admin
   *   dentro da funcionalidade configurada (acesso completo: criar, editar, excluir, etc.)
   * - Viewer (permission_type='viewer') pode apenas visualizar (sem ações)
   * - None (permission_type='none') não tem acesso (bloqueado)
   * 
   * @param {string} functionId - ID da funcionalidade
   * @param {string} requiredPermission - Permissão necessária ('editor', 'viewer', 'none')
   * @returns {boolean}
   */
  const hasPermission = useMemo(() => {
    return (functionId, requiredPermission = PERMISSION_TYPES.EDITOR) => {
      // REGRA DE NEGÓCIO: Admin sempre tem acesso completo (bypass)
      if (user?.role === 'admin') {
        return true
      }

      if (!user?.role) {
        return false
      }

      // REGRA DE NEGÓCIO: Editor é o padrão quando não há permissão configurada
      // Isso garante que todas as funcionalidades vêm liberadas por padrão (alinhado com o backend)
      const userPermission = permissions[functionId]?.[user.role] || PERMISSION_TYPES.EDITOR

      // REGRA DE NEGÓCIO: Hierarquia de permissões
      // Editor (nível 2) = Admin dentro da funcionalidade (acesso completo)
      // Viewer (nível 1) = apenas visualização
      // None (nível 0) = sem acesso
      const userLevel = PERMISSION_HIERARCHY[userPermission] || 0
      const requiredLevel = PERMISSION_HIERARCHY[requiredPermission] ?? 2 // Máximo é 2 (EDITOR)

      // REGRA DE NEGÓCIO: Editor (nível 2) sempre tem acesso se o nível requerido for <= 2
      // Isso garante que Editor tem os mesmos privilégios que Admin
      const hasAccess = userLevel >= requiredLevel

      return hasAccess
    }
  }, [permissions, user])

  /**
   * Verifica se o usuário pode acessar um recurso específico
   * @param {string} functionId - ID da funcionalidade
   * @param {number} resourceOwnerId - ID do proprietário do recurso
   * @param {string} ownerField - Campo do proprietário ('supplier_id' ou 'plant_id')
   * @returns {boolean}
   */
  const canAccessResource = useMemo(() => {
    return (functionId, resourceOwnerId, ownerField = 'supplier_id') => {
      // Admin sempre tem acesso
      if (user?.role === 'admin') {
        return true
      }

      if (!user?.role) {
        return false
      }

      // REGRA DE NEGÓCIO: Editor é o padrão quando não há permissão configurada
      const userPermission = permissions[functionId]?.[user.role] || PERMISSION_TYPES.EDITOR

      if (userPermission === PERMISSION_TYPES.EDITOR) {
        return true
      }

      if (userPermission === PERMISSION_TYPES.VIEWER) {
        return true
      }

      return false
    }
  }, [permissions, user])

  /**
   * Verifica se o usuário tem pelo menos permissão "viewer" (não é "none")
   * Útil para mostrar botões que devem aparecer mesmo em modo visualização
   * @param {string} functionId - ID da funcionalidade
   * @returns {boolean}
   */
  const hasViewPermission = useMemo(() => {
    return (functionId) => {
      // Admin sempre tem acesso
      if (user?.role === 'admin') {
        return true
      }

      if (!user?.role) {
        return false
      }

      // Verificar se há permissão configurada para esta função e role
      const functionPermissions = permissions[functionId]
      if (!functionPermissions) {
        // Se não há permissão configurada, retornar true (editor como padrão)
        return true
      }

      const userPermission = functionPermissions[user.role] || PERMISSION_TYPES.EDITOR
      const hasAccess = userPermission !== PERMISSION_TYPES.NONE
      
      return hasAccess
    }
  }, [permissions, user])

  /**
   * Retorna o tipo de permissão do usuário para uma funcionalidade
   * @param {string} functionId - ID da funcionalidade
   * @returns {string} - 'editor', 'viewer' ou 'none'
   */
  const getPermissionType = useMemo(() => {
    return (functionId) => {
      if (user?.role === 'admin') {
        return PERMISSION_TYPES.EDITOR
      }

      if (!user?.role) {
        return PERMISSION_TYPES.NONE
      }

      // REGRA DE NEGÓCIO: Editor é o padrão quando não há permissão configurada
      // Isso garante que todas as funcionalidades vêm liberadas por padrão (alinhado com o backend)
      return permissions[functionId]?.[user.role] || PERMISSION_TYPES.EDITOR
    }
  }, [permissions, user])

  return {
    hasPermission,
    canAccessResource,
    hasViewPermission,
    getPermissionType,
    loading,
    permissions
  }
}

export default usePermissions
export { PERMISSION_TYPES }

