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
        
        console.log('Permissões carregadas:', {
          userEmail: user?.email,
          userRole: user?.role,
          permissionsData: data,
          permissionsCount: Object.keys(data || {}).length,
          allKeys: Object.keys(data || {}),
          samplePermission: data?.['create_appointment']
        })
        
        setPermissions(data || {})
      } catch (err) {
        console.error('Erro ao carregar permissões:', err)
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

      // REGRA DE NEGÓCIO: Sem acesso é o padrão quando não há permissão configurada
      // Não deve haver padrão permissivo - se não está configurado, é "none" (Sem acesso)
      const userPermission = permissions[functionId]?.[user.role] || PERMISSION_TYPES.NONE

      // Debug para portaria@wps.com
      if (user?.email === 'portaria@wps.com' || user?.email === 'portaria.central@wps.com') {
        console.log('Verificando permissão:', {
          functionId,
          userRole: user.role,
          permissionsForFunction: permissions[functionId],
          userPermission,
          requiredPermission,
          allPermissions: permissions
        })
      }

      // REGRA DE NEGÓCIO: Hierarquia de permissões
      // Editor (nível 2) = Admin dentro da funcionalidade (acesso completo)
      // Viewer (nível 1) = apenas visualização
      // None (nível 0) = sem acesso
      const userLevel = PERMISSION_HIERARCHY[userPermission] || 0
      const requiredLevel = PERMISSION_HIERARCHY[requiredPermission] ?? 2 // Máximo é 2 (EDITOR)

      // REGRA DE NEGÓCIO: Editor (nível 2) sempre tem acesso se o nível requerido for <= 2
      // Isso garante que Editor tem os mesmos privilégios que Admin
      const hasAccess = userLevel >= requiredLevel
      
      // Debug para portaria@wps.com
      if (user?.email === 'portaria@wps.com' || user?.email === 'portaria.central@wps.com') {
        console.log('Resultado da verificação:', {
          functionId,
          userLevel,
          requiredLevel,
          hasAccess
        })
      }

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

      const userPermission = permissions[functionId]?.[user.role] || PERMISSION_TYPES.NONE

      if (userPermission === PERMISSION_TYPES.EDITOR) {
        return true
      }

      if (userPermission === PERMISSION_TYPES.VIEWER) {
        return true
      }

      return false
    }
  }, [permissions, user])

  return {
    hasPermission,
    canAccessResource,
    loading,
    permissions
  }
}

export default usePermissions
export { PERMISSION_TYPES }

