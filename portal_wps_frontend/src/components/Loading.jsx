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
      
      {/* CSS para animações customizadas */}
      <style>{`
        @keyframes moveLine {
          0% {
            stroke-dashoffset: 0;
            opacity: 0.4;
          }
          50% {
            stroke-dashoffset: -6;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -12;
            opacity: 0.4;
          }
        }
        
        @keyframes floatBox {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-3px) scale(1.02);
          }
        }
        
        .motion-line-1,
        .motion-line-2,
        .motion-line-3 {
          stroke-dasharray: 4 8;
          stroke-dashoffset: 0;
          animation: moveLine 1.2s linear infinite;
        }
        
        .motion-line-2 {
          animation-delay: 0.2s;
        }
        
        .motion-line-3 {
          animation-delay: 0.4s;
        }
      `}</style>
    </div>
  )
}

export default Loading
