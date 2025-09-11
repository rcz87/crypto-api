import { Clock, Database, Wifi, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatToWIB, getTimeElapsed, formatLatency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DataTrustIndicatorProps {
  /** Data source identifier (e.g., "OKX", "CoinAPI", "Enhanced AI") */
  dataSource: string;
  /** Timestamp when data was last updated */
  timestamp: string | Date;
  /** API response latency in milliseconds */
  latency?: number;
  /** Whether the data is real-time or cached */
  isRealTime?: boolean;
  /** Custom CSS classes for styling */
  className?: string;
  /** Size variant for responsive design */
  size?: 'sm' | 'md' | 'lg';
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Show detailed view with tooltip */
  showTooltip?: boolean;
}

/**
 * Data Trust Indicator Component
 * Shows data source, timestamp in WIB timezone, and latency information
 * Responsive design with professional styling
 */
export function DataTrustIndicator({
  dataSource,
  timestamp,
  latency,
  isRealTime = false,
  className,
  size = 'md',
  orientation = 'horizontal',
  showTooltip = true,
}: DataTrustIndicatorProps) {
  const timeElapsed = getTimeElapsed(timestamp);
  const wibTime = formatToWIB(timestamp);
  const latencyInfo = latency ? formatLatency(latency) : null;

  // Size-based styling
  const sizeClasses = {
    sm: {
      container: 'text-xs space-x-1',
      badge: 'text-xs px-1.5 py-0.5',
      icon: 'w-3 h-3',
    },
    md: {
      container: 'text-sm space-x-2',
      badge: 'text-xs px-2 py-1',
      icon: 'w-4 h-4',
    },
    lg: {
      container: 'text-base space-x-2',
      badge: 'text-sm px-2.5 py-1',
      icon: 'w-5 h-5',
    },
  };

  // Data source styling
  const getDataSourceStyle = (source: string) => {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('okx')) {
      return 'bg-blue-600/20 text-blue-400 border-blue-500/30';
    } else if (lowerSource.includes('coinapi')) {
      return 'bg-purple-600/20 text-purple-400 border-purple-500/30';
    } else if (lowerSource.includes('ai') || lowerSource.includes('enhanced')) {
      return 'bg-green-600/20 text-green-400 border-green-500/30';
    } else {
      return 'bg-gray-600/20 text-gray-400 border-gray-500/30';
    }
  };

  // Get appropriate data source icon
  const getDataSourceIcon = (source: string) => {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('ai') || lowerSource.includes('enhanced')) {
      return Activity;
    } else {
      return Database;
    }
  };

  const DataSourceIcon = getDataSourceIcon(dataSource);
  const currentSizeClasses = sizeClasses[size];

  const IndicatorContent = () => (
    <div 
      className={cn(
        'flex items-center gap-1 text-gray-400',
        orientation === 'vertical' ? 'flex-col space-y-1' : 'flex-row',
        currentSizeClasses.container,
        className
      )}
      data-testid="data-trust-indicator"
    >
      {/* Data Source Badge */}
      <Badge
        variant="outline"
        className={cn(
          'flex items-center gap-1 font-medium border',
          getDataSourceStyle(dataSource),
          currentSizeClasses.badge
        )}
      >
        <DataSourceIcon className={currentSizeClasses.icon} />
        {dataSource}
        {isRealTime && (
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
        )}
      </Badge>

      {/* Time Information */}
      <div className="flex items-center gap-1 text-gray-500">
        <Clock className={currentSizeClasses.icon} />
        <span className="font-mono">{timeElapsed}</span>
      </div>

      {/* Latency Information */}
      {latencyInfo && (
        <div className="flex items-center gap-1">
          <Wifi className={currentSizeClasses.icon} />
          <span className={cn('font-mono font-medium', latencyInfo.className)}>
            {latencyInfo.text}
          </span>
        </div>
      )}
    </div>
  );

  if (!showTooltip) {
    return <IndicatorContent />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <IndicatorContent />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-800 border-gray-700 text-gray-200">
          <div className="space-y-1">
            <div className="font-medium">Data Trust Information</div>
            <div className="text-sm space-y-1">
              <div><strong>Source:</strong> {dataSource}</div>
              <div><strong>Last Updated:</strong> {wibTime}</div>
              <div><strong>Time Elapsed:</strong> {timeElapsed}</div>
              {latencyInfo && (
                <div><strong>Response Time:</strong> {latencyInfo.text}</div>
              )}
              <div><strong>Status:</strong> {isRealTime ? 'Real-time' : 'Cached'}</div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact Data Trust Indicator for tight spaces
 */
export function CompactDataTrustIndicator({
  dataSource,
  timestamp,
  latency,
  className,
}: Pick<DataTrustIndicatorProps, 'dataSource' | 'timestamp' | 'latency' | 'className'>) {
  return (
    <DataTrustIndicator
      dataSource={dataSource}
      timestamp={timestamp}
      latency={latency}
      size="sm"
      orientation="horizontal"
      showTooltip={true}
      className={className}
    />
  );
}

/**
 * Mobile-optimized Data Trust Indicator
 */
export function MobileDataTrustIndicator({
  dataSource,
  timestamp,
  latency,
  className,
}: Pick<DataTrustIndicatorProps, 'dataSource' | 'timestamp' | 'latency' | 'className'>) {
  return (
    <DataTrustIndicator
      dataSource={dataSource}
      timestamp={timestamp}
      latency={latency}
      size="sm"
      orientation="vertical"
      showTooltip={false}
      className={cn('justify-center text-center', className)}
    />
  );
}