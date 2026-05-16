function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const baseClassName = "animate-pulse rounded-md bg-primary/10"
  const skeletonClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName

  return (
    <div
      className={skeletonClassName}
      {...props}
    />
  )
}

export { Skeleton }
