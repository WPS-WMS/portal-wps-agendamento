import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Truck, 
  Clock, 
  Shield, 
  Users, 
  UserCheck, 
  History, 
  CheckCircle2,
  ArrowRight,
  Calendar,
  Lock
} from 'lucide-react'

const LandingPage = () => {
  const navigate = useNavigate()

  const features = [
    {
      icon: Clock,
      title: 'Agendamento por slots de 30 minutos',
      description: 'Sistema preciso de agendamento com intervalos de 30 minutos para melhor controle logístico.'
    },
    {
      icon: Lock,
      title: 'Bloqueio automático quando planta atinge limite',
      description: 'O sistema bloqueia automaticamente novos agendamentos quando a capacidade máxima é atingida.'
    },
    {
      icon: Users,
      title: 'Gestão de fornecedores',
      description: 'Controle completo de fornecedores cadastrados com informações detalhadas e histórico.'
    },
    {
      icon: Shield,
      title: 'Perfis de acesso',
      description: 'Sistema de permissões com diferentes níveis: Admin, Planta e Fornecedor.'
    },
    {
      icon: UserCheck,
      title: 'Ativação/inativação de usuários',
      description: 'Controle total sobre o acesso dos usuários ao sistema.'
    },
    {
      icon: History,
      title: 'Histórico de agendamentos',
      description: 'Acompanhamento completo de todos os agendamentos realizados com filtros e buscas.'
    }
  ]

  const steps = [
    {
      number: '1',
      title: 'Empresa cadastra plantas',
      description: 'Administradores cadastram as plantas com horários de funcionamento e capacidade de recebimento.'
    },
    {
      number: '2',
      title: 'Fornecedores acessam o portal',
      description: 'Fornecedores fazem login e visualizam as plantas disponíveis e horários livres.'
    },
    {
      number: '3',
      title: 'Escolhem horários disponíveis',
      description: 'Fornecedores selecionam os horários desejados diretamente no calendário interativo.'
    },
    {
      number: '4',
      title: 'Sistema bloqueia automaticamente conflitos',
      description: 'O sistema previne conflitos e garante que a capacidade máxima seja respeitada.'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header Fixo */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">CargoFlow</span>
            </div>
            <Button 
              onClick={() => navigate('/login')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Entrar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Agendamentos logísticos{' '}
                <span className="text-blue-600">simples, rápidos</span> e inteligentes.
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Centralize fornecedores, plantas e horários em uma única plataforma.
              </p>
              <Button
                onClick={() => navigate('/login')}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 h-auto group"
              >
                Começar agora
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl transform rotate-3 opacity-20"></div>
                <Card className="relative shadow-2xl border-0 bg-white rounded-2xl overflow-hidden">
                  <CardContent className="p-0">
                    {/* Header do Dashboard */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 border-b border-blue-500">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Calendário de Agendamentos</h3>
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    {/* Simulação do Calendário Real */}
                    <div className="bg-white p-4">
                      <div className="flex border border-gray-200 rounded-lg overflow-hidden shadow-sm" style={{ height: '384px' }}>
                        {/* Coluna de Horários */}
                        <div className="w-20 bg-gray-50 border-r border-gray-200 flex-shrink-0">
                          {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'].map((time, idx) => (
                            <div 
                              key={time}
                              className="h-12 border-b border-gray-200 flex items-center justify-end pr-2 last:border-b-0"
                            >
                              <span className="text-xs font-semibold text-gray-700">{time}</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Colunas de Agendamentos */}
                        <div className="flex-1 flex relative" style={{ minHeight: '384px' }}>
                          {/* Coluna 1 */}
                          <div className="flex-1 border-r border-gray-200 relative">
                            {/* Linhas de horário */}
                            {Array.from({ length: 8 }, (_, idx) => (
                              <div 
                                key={`col1-line-${idx}`}
                                className="absolute left-0 right-0 border-b border-dashed border-gray-200"
                                style={{ top: `${idx * 48}px`, height: '48px' }}
                              />
                            ))}
                            
                            {/* Card 1: 09:00 - 10:30 (3 linhas) */}
                            <div 
                              className="absolute left-1 right-1 bg-blue-500 text-white rounded px-2 py-1.5 text-xs font-medium shadow-sm z-10"
                              style={{ top: '48px', height: '96px' }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">Fornecedor A</span>
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <div className="text-[10px] opacity-90">09:00 - 10:30</div>
                            </div>
                            
                            {/* Card 2: 11:00 - 12:00 (2 linhas) */}
                            <div 
                              className="absolute left-1 right-1 bg-green-500 text-white rounded px-2 py-1.5 text-xs font-medium shadow-sm z-10"
                              style={{ top: '144px', height: '48px' }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">Fornecedor B</span>
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <div className="text-[10px] opacity-90">11:00 - 12:00</div>
                            </div>
                            
                            {/* Card 3: 13:00 - 14:00 (2 linhas) */}
                            <div 
                              className="absolute left-1 right-1 bg-indigo-500 text-white rounded px-2 py-1.5 text-xs font-medium shadow-sm z-10"
                              style={{ top: '240px', height: '48px' }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">Fornecedor C</span>
                                <Clock className="w-3 h-3" />
                              </div>
                              <div className="text-[10px] opacity-90">13:00 - 14:00</div>
                            </div>
                          </div>
                          
                          {/* Coluna 2 */}
                          <div className="flex-1 border-r border-gray-200 relative">
                            {/* Linhas de horário */}
                            {Array.from({ length: 8 }, (_, idx) => (
                              <div 
                                key={`col2-line-${idx}`}
                                className="absolute left-0 right-0 border-b border-dashed border-gray-200"
                                style={{ top: `${idx * 48}px`, height: '48px' }}
                              />
                            ))}
                            
                            {/* Card 1: 10:00 - 11:00 (2 linhas) */}
                            <div 
                              className="absolute left-1 right-1 bg-purple-500 text-white rounded px-2 py-1.5 text-xs font-medium shadow-sm z-10"
                              style={{ top: '96px', height: '48px' }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">Fornecedor D</span>
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <div className="text-[10px] opacity-90">10:00 - 11:00</div>
                            </div>
                            
                            {/* Card 2: 14:00 - 15:00 (2 linhas) */}
                            <div 
                              className="absolute left-1 right-1 bg-teal-500 text-white rounded px-2 py-1.5 text-xs font-medium shadow-sm z-10"
                              style={{ top: '288px', height: '48px' }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">Fornecedor E</span>
                                <Clock className="w-3 h-3" />
                              </div>
                              <div className="text-[10px] opacity-90">14:00 - 15:00</div>
                            </div>
                          </div>
                          
                          {/* Coluna 3 (vazia para mostrar disponibilidade) */}
                          <div className="flex-1 relative">
                            {/* Linhas de horário */}
                            {Array.from({ length: 8 }, (_, idx) => (
                              <div 
                                key={`col3-line-${idx}`}
                                className="absolute left-0 right-0 border-b border-dashed border-gray-200 hover:bg-blue-50/50 transition-colors"
                                style={{ top: `${idx * 48}px`, height: '48px' }}
                              />
                            ))}
                            
                            {/* Slots disponíveis */}
                            {[0, 4, 7].map((idx) => (
                              <div 
                                key={`available-${idx}`}
                                className="absolute inset-1 border-2 border-dashed border-blue-300 rounded bg-blue-50/30 flex items-center justify-center z-10"
                                style={{ top: `${idx * 48 + 4}px`, height: '40px' }}
                              >
                                <span className="text-[10px] text-blue-600 font-medium">Disponível</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Legenda */}
                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-blue-500 rounded"></div>
                          <span>Agendado</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-dashed border-blue-300 rounded bg-blue-50/30"></div>
                          <span>Disponível</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção: O que é o CargoFlow? */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            O que é o CargoFlow?
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Plataforma de agendamento de cargas entre fornecedores e plantas, com controle de horários, 
            limites por planta e gestão de usuários. Simplifique sua operação logística com uma solução 
            completa e intuitiva.
          </p>
        </div>
      </section>

      {/* Seção: Principais funcionalidades */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Principais funcionalidades
            </h2>
            <p className="text-lg text-gray-600">
              Tudo que você precisa para gerenciar seus agendamentos logísticos
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card 
                  key={index}
                  className="border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group cursor-default"
                >
                  <CardContent className="p-6 space-y-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                      <Icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Seção: Como funciona */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Como funciona
            </h2>
            <p className="text-lg text-gray-600">
              Processo simples em 4 passos
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <Card className="border border-gray-200 hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                        {step.number}
                      </div>
                      {index < steps.length - 1 && (
                        <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gray-200 -z-10">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full"></div>
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Final */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Pronto para organizar sua logística?
          </h2>
          <p className="text-xl text-blue-100">
            Acesse o sistema e comece a gerenciar seus agendamentos hoje mesmo.
          </p>
          <Button
            onClick={() => navigate('/login')}
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6 h-auto group"
          >
            Acessar sistema
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">CargoFlow</span>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} CargoFlow. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
