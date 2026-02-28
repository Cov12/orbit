interface LogoProps {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-12 h-12 text-lg",
};

export function Logo({ size = "md" }: LogoProps) {
  return (
    <div className={`${sizes[size]} rounded-lg gradient-primary flex items-center justify-center font-bold`}>
      W
    </div>
  );
}
