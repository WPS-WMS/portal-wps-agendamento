import Logo from './Logo'

const Loading = ({ message = 'Inicializando sistema...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-6">
        {/* Logo com animação de movimento */}
        <div className="flex justify-center">
          <div className="relative animate-pulse">
            <Logo showText={false} size="large" />
          </div>
        </div>
        
        {/* Mensagem de loading com dots animados */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          <p className="ml-3 text-gray-600 font-medium">{message}</p>
        </div>
      </div>
    </div>
  )
}

export default Loading
