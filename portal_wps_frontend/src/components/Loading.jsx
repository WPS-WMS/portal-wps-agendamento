const Loading = ({ message = 'Inicializando sistema...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-6">
        {/* Logo com animação de movimento */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Ícone: Caixa/Cubo Laranja 3D com linhas de movimento animadas */}
            <div className="w-24 h-24 mx-auto relative">
              <svg 
                viewBox="0 0 40 40" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                {/* Linhas horizontais de movimento animadas - efeito de movimento contínuo */}
                <g>
                  {/* Linha 1 */}
                  <line 
                    x1="2" y1="18" x2="8" y2="18" 
                    stroke="#FF6B35" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    className="motion-line-1"
                  />
                  {/* Linha 2 */}
                  <line 
                    x1="2" y1="22" x2="8" y2="22" 
                    stroke="#FF6B35" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    className="motion-line-2"
                  />
                  {/* Linha 3 */}
                  <line 
                    x1="2" y1="26" x2="8" y2="26" 
                    stroke="#FF6B35" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    className="motion-line-3"
                  />
                </g>
                
                {/* Caixa 3D com perspectiva - animação suave de flutuação */}
                <g 
                  className="box-3d"
                  style={{
                    animation: 'floatBox 2s ease-in-out infinite'
                  }}
                >
                  {/* Face frontal (laranja vibrante) */}
                  <rect x="8" y="12" width="20" height="20" fill="#FF6B35" rx="2"/>
                  
                  {/* Face superior (sombra 3D - mais escura) */}
                  <path d="M8 12 L18 6 L28 12" fill="#E55A2B"/>
                  
                  {/* Face lateral direita (mais escura ainda) */}
                  <path d="M28 12 L38 6 L38 26 L28 32" fill="#CC4A1F"/>
                  
                  {/* Destaque na face frontal para efeito 3D */}
                  <rect x="10" y="14" width="16" height="16" fill="#FF8C5A" opacity="0.3" rx="1"/>
                </g>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Texto CargoFlow */}
        <div className="flex items-center justify-center space-x-3">
          <div className="text-2xl">
            <span className="font-bold text-gray-900">Cargo</span>
            <span className="font-bold text-[#FF6B35]">Flow</span>
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
