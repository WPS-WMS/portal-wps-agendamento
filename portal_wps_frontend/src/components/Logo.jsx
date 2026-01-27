const Logo = ({ className = "", showText = false, size = "default" }) => {
  // Tamanhos maiores para o logo - aumentados para melhor visibilidade
  const iconSize = size === "small" ? "w-24 h-24" : size === "large" ? "w-40 h-40" : "w-32 h-32"
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${iconSize} relative flex-shrink-0`}>
        <img 
          src="/logo.svg" 
          alt="CargoFlow Logo" 
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  )
}

export default Logo
