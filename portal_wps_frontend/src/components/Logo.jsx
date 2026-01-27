const Logo = ({ className = "", showText = false, size = "default" }) => {
  // Tamanhos maiores para o logo - aumentados significativamente para melhor visibilidade
  const iconSize = size === "small" ? "w-40 h-40" : size === "large" ? "w-64 h-64" : "w-48 h-48"
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* Logo PNG */}
      <div className={`${iconSize} relative flex-shrink-0 overflow-visible`}>
        <img 
          src="/logo.png" 
          alt="CargoFlow Logo" 
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  )
}

export default Logo
