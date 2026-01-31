import { Heart } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { useState } from "react";

export default function RatingHearts({ 
  rating = 0, 
  count = 0,
  interactive = false, 
  onRate = null,
  size = "md",
  showCount = true
}) {
  const { theme } = useTheme();
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };
  
  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };
  
  const iconSize = sizeClasses[size] || sizeClasses.md;
  const textSize = textSizeClasses[size] || textSizeClasses.md;
  
  const displayRating = interactive && hoverRating > 0 ? hoverRating : rating;
  
  const handleClick = (value) => {
    if (interactive && onRate) {
      onRate(value);
    }
  };
  
  const handleMouseEnter = (value) => {
    if (interactive) {
      setHoverRating(value);
    }
  };
  
  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };
  
  const getHeartFill = (position) => {
    const fillAmount = displayRating - (position - 1);
    
    if (fillAmount >= 1) return "full";
    if (fillAmount > 0 && fillAmount < 1) return "partial";
    return "empty";
  };
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((value) => {
          const fill = getHeartFill(value);
          const isHovered = interactive && hoverRating >= value;
          
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleClick(value)}
              onMouseEnter={() => handleMouseEnter(value)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive}
              className={`
                ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                transition-all duration-150
                ${!interactive && 'pointer-events-none'}
              `}
              style={{
                color: fill === "full" || fill === "partial" || isHovered 
                  ? theme.colors.accentYellow 
                  : theme.colors.textSecondary
              }}
              title={interactive ? `Rate ${value} hearts` : undefined}
            >
              <Heart 
                className={`
                  ${iconSize}
                  ${(fill === "full" || isHovered) && 'fill-current'}
                  transition-all duration-150
                `}
                style={{
                  opacity: fill === "partial" ? 0.5 : 1
                }}
              />
            </button>
          );
        })}
      </div>
      
      {showCount && count > 0 && (
        <span 
          style={{ color: theme.colors.textSecondary }}
          className={`${textSize} font-medium`}
        >
          ({rating > 0 ? rating.toFixed(1) : '0.0'}) · {count}
        </span>
      )}
      
      {showCount && count === 0 && rating === 0 && (
        <span 
          style={{ color: theme.colors.textSecondary }}
          className={`${textSize} font-medium`}
        >
          No ratings yet
        </span>
      )}
    </div>
  );
}
