import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Activity, 
  Brain, 
  BarChart3, 
  Target, 
  Zap, 
  Search, 
  RefreshCw,
  ChevronRight,
  HelpCircle,
  Settings,
  Database,
  Wifi,
  Clock
} from "lucide-react";

// Generic empty state
export function EmptyState({ 
  icon: Icon = Database,
  title, 
  description, 
  actionText, 
  onAction, 
  className = "" 
}: {
  icon?: any;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardContent className="p-8">
        <div className="text-center space-y-4">
          <Icon className="h-16 w-16 mx-auto text-gray-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2" data-testid="empty-title">
              {title}
            </h3>
            <p className="text-gray-500 mb-4" data-testid="empty-description">
              {description}
            </p>
          </div>
          {onAction && actionText && (
            <Button 
              onClick={onAction} 
              variant="outline" 
              className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              data-testid="button-empty-action"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {actionText}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Screening results empty state
export function EmptyScreeningResults({ onRefresh, className = "" }: {
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="h-5 w-5" />
          Multi-Coin Screening
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <Search className="h-16 w-16 mx-auto text-gray-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2" data-testid="empty-screening-title">
              Belum Ada Hasil Screening
            </h3>
            <p className="text-gray-500 mb-4" data-testid="empty-screening-description">
              Pilih pasangan kripto dan jalankan screening untuk melihat sinyal trading.
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Gunakan set populer seperti "Top 5" atau "DeFi"</p>
              <p>• Pilih timeframe sesuai strategi trading Anda</p>
              <p>• Aktifkan auto-refresh untuk monitoring real-time</p>
            </div>
          </div>
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              className="border-green-500 text-green-400 hover:bg-green-500/10"
              data-testid="button-start-screening"
            >
              <Target className="h-4 w-4 mr-2" />
              Mulai Screening
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Trading signals empty state
export function EmptyTradingSignals({ onRefresh, className = "" }: {
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Trading Signals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <Brain className="h-16 w-16 mx-auto text-gray-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2" data-testid="empty-signals-title">
              Menunggu Sinyal AI
            </h3>
            <p className="text-gray-500 mb-4" data-testid="empty-signals-description">
              Sistem AI sedang menganalisis pasar untuk menghasilkan sinyal trading.
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Analisis multi-layer sedang berjalan</p>
              <p>• Pemrosesan data real-time dari berbagai sumber</p>
              <p>• Sinyal akan muncul ketika kondisi optimal terdeteksi</p>
            </div>
          </div>
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
              data-testid="button-force-ai-analysis"
            >
              <Zap className="h-4 w-4 mr-2" />
              Paksa Analisis AI
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Trading data empty state
export function EmptyTradingData({ symbol = "SOL/USDT", onRefresh, className = "" }: {
  symbol?: string;
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Data Trading {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <Activity className="h-16 w-16 mx-auto text-gray-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2" data-testid="empty-trading-title">
              Data Trading Belum Tersedia
            </h3>
            <p className="text-gray-500 mb-4" data-testid="empty-trading-description">
              Menunggu data real-time dari exchange untuk {symbol}.
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Pastikan koneksi internet stabil</p>
              <p>• Data akan muncul otomatis setelah terhubung</p>
              <p>• Periksa status koneksi WebSocket</p>
            </div>
          </div>
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              data-testid="button-connect-trading"
            >
              <Wifi className="h-4 w-4 mr-2" />
              Hubungkan ke Exchange
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Order flow empty state
export function EmptyOrderFlow({ onRefresh, className = "" }: {
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Order Flow & Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 space-y-4">
          <TrendingUp className="h-12 w-12 mx-auto text-gray-500" />
          <div>
            <h3 className="text-base font-semibold text-gray-300 mb-2" data-testid="empty-orderflow-title">
              Menunggu Data Real-time
            </h3>
            <p className="text-sm text-gray-500" data-testid="empty-orderflow-description">
              Order flow akan muncul setelah terhubung ke WebSocket.
            </p>
          </div>
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              size="sm"
              variant="outline" 
              className="border-green-500 text-green-400 hover:bg-green-500/10"
              data-testid="button-connect-orderflow"
            >
              <Wifi className="h-3 w-3 mr-2" />
              Hubungkan
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Chart empty state
export function EmptyChart({ title = "Trading Chart", onRefresh, className = "" }: {
  title?: string;
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-16 space-y-4">
          <BarChart3 className="h-16 w-16 mx-auto text-gray-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2" data-testid="empty-chart-title">
              Chart Belum Dimuat
            </h3>
            <p className="text-gray-500 mb-4" data-testid="empty-chart-description">
              Membutuhkan data harga untuk menampilkan grafik trading.
            </p>
          </div>
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              data-testid="button-load-chart"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Muat Chart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// No connection state
export function NoConnectionState({ onRetry, className = "" }: {
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`text-center py-8 space-y-4 ${className}`}>
      <Wifi className="h-12 w-12 mx-auto text-gray-500" />
      <div>
        <h3 className="text-base font-semibold text-gray-300 mb-2" data-testid="no-connection-title">
          Tidak Ada Koneksi
        </h3>
        <p className="text-sm text-gray-500 mb-4" data-testid="no-connection-description">
          Periksa koneksi internet Anda.
        </p>
      </div>
      {onRetry && (
        <Button 
          onClick={onRetry} 
          size="sm"
          variant="outline" 
          className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
          data-testid="button-retry-connection"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}