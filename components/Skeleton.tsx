type SkeletonProps = {
  className?: string
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[linear-gradient(110deg,rgba(30,41,59,0.88),rgba(51,65,85,0.68),rgba(30,41,59,0.88))] bg-[length:200%_100%] [animation-duration:1.6s] ${className}`}
    />
  )
}
