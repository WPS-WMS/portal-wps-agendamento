const Logo = ({ className = "", showText = true, size = "default" }) => {
  const iconSize = size === "small" ? "w-8 h-8" : size === "large" ? "w-16 h-16" : "w-10 h-10"
  const textSize = size === "small" ? "text-lg" : size === "large" ? "text-2xl" : "text-xl"
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Ícone: Caixa/Cubo Laranja 3D com linhas de movimento */}
      <div className={`${iconSize} relative flex-shrink-0`}>
        <svg 
          viewBox="0 0 40 40" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Linhas horizontais de movimento (à esquerda) */}
          <line x1="2" y1="18" x2="8" y2="18" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="2" y1="22" x2="8" y2="22" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="2" y1="26" x2="8" y2="26" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round"/>
          
          {/* Caixa 3D com perspectiva */}
          {/* Face frontal (laranja vibrante) */}
          <rect x="8" y="12" width="20" height="20" fill="#FF6B35" rx="2"/>
          
          {/* Face superior (sombra 3D - mais escura) */}
          <path d="M8 12 L18 6 L28 12" fill="#E55A2B"/>
          
          {/* Face lateral direita (mais escura ainda) */}
          <path d="M28 12 L38 6 L38 26 L28 32" fill="#CC4A1F"/>
          
          {/* Destaque na face frontal para efeito 3D */}
          <rect x="10" y="14" width="16" height="16" fill="#FF8C5A" opacity="0.3" rx="1"/>
        </svg>
      </div>
      
      {/* Texto: CargoFlow */}
      {showText && (
        <div className={textSize}>
          <span className="font-bold text-gray-900">Cargo</span>
          <span className="font-bold text-[#FF6B35]">Flow</span>
        </div>
      )}
    </div>
  )
}

export default Logo
