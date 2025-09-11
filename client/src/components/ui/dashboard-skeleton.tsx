import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Card skeleton for basic card layouts
export function CardSkeleton({ 
  showHeader = true, 
  rows = 3, 
  className = "" 
}: { 
  showHeader?: boolean; 
  rows?: number; 
  className?: string; 
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-gray-700" />
          <Skeleton className="h-4 w-32 bg-gray-800" />
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full bg-gray-700" />
        ))}
      </CardContent>
    </Card>
  );
}

// Chart skeleton for trading charts and analytics
export function ChartSkeleton({ 
  height = "h-64", 
  className = "" 
}: { 
  height?: string; 
  className?: string; 
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40 bg-gray-700" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 bg-gray-700" />
            <Skeleton className="h-8 w-16 bg-gray-700" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className={`${height} w-full bg-gray-700 rounded-lg`} />
      </CardContent>
    </Card>
  );
}

// Table skeleton for data tables
export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className = "" 
}: { 
  rows?: number; 
  columns?: number; 
  className?: string; 
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <Skeleton className="h-6 w-48 bg-gray-700" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Table Header */}
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1 bg-gray-600" />
            ))}
          </div>
          {/* Table Rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 flex-1 bg-gray-700" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Metrics skeleton for AI signals and performance data
export function MetricsSkeleton({ 
  metrics = 4, 
  className = "" 
}: { 
  metrics?: number; 
  className?: string; 
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <Skeleton className="h-6 w-56 bg-gray-700" />
        <Skeleton className="h-4 w-40 bg-gray-800" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: metrics }).map((_, i) => (
            <div key={i} className="p-4 border border-gray-700 rounded-lg space-y-2">
              <Skeleton className="h-4 w-24 bg-gray-600" />
              <Skeleton className="h-8 w-16 bg-gray-700" />
              <Skeleton className="h-3 w-32 bg-gray-800" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// List skeleton for screening results and order flow
export function ListSkeleton({ 
  items = 6, 
  showAvatar = false, 
  className = "" 
}: { 
  items?: number; 
  showAvatar?: boolean; 
  className?: string; 
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <Skeleton className="h-6 w-44 bg-gray-700" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              {showAvatar && <Skeleton className="h-10 w-10 rounded-full bg-gray-700" />}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full bg-gray-700" />
                <Skeleton className="h-3 w-3/4 bg-gray-800" />
              </div>
              <Skeleton className="h-6 w-16 bg-gray-600" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Tabs skeleton for components with multiple views
export function TabsSkeleton({ 
  tabCount = 3, 
  contentHeight = "h-48", 
  className = "" 
}: { 
  tabCount?: number; 
  contentHeight?: string; 
  className?: string; 
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <Skeleton className="h-6 w-48 bg-gray-700" />
      </CardHeader>
      <CardContent>
        {/* Tab buttons */}
        <div className="flex gap-2 mb-4">
          {Array.from({ length: tabCount }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 bg-gray-700" />
          ))}
        </div>
        {/* Tab content */}
        <Skeleton className={`${contentHeight} w-full bg-gray-700 rounded-lg`} />
      </CardContent>
    </Card>
  );
}