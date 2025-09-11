import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Database, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Activity,
  BarChart3,
  Brain,
  Target,
  Settings,
  HelpCircle
} from "lucide-react";

// Error message translations to Indonesian
const ERROR_MESSAGES = {
  network_error: {
    title: "Koneksi Terputus",
    description: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
    action: "Coba Lagi"
  },
  timeout_error: {
    title: "Waktu Habis",
    description: "Permintaan memakan waktu terlalu lama. Server mungkin sedang sibuk.",
    action: "Muat Ulang"
  },
  server_error: {
    title: "Kesalahan Server", 
    description: "Terjadi masalah pada server. Tim kami sedang menyelidiki.",
    action: "Coba Lagi"
  },
  data_error: {
    title: "Data Tidak Tersedia",
    description: "Data tidak dapat dimuat saat ini. Coba beberapa saat lagi.",
    action: "Refresh Data"
  },
  websocket_error: {
    title: "Koneksi Real-time Terputus",
    description: "Kehilangan koneksi data real-time. Mencoba menghubungkan kembali...",
    action: "Hubungkan Ulang"
  },
  api_limit: {
    title: "Batas API Tercapai",
    description: "Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba lagi.",
    action: "Tunggu & Coba Lagi"
  },
  parsing_error: {
    title: "Format Data Salah",
    description: "Data dari server memiliki format yang tidak dikenali.",
    action: "Laporkan Masalah"
  },
  auth_error: {
    title: "Akses Ditolak",
    description: "Anda tidak memiliki izin untuk mengakses data ini.",
    action: "Periksa Kredensial"
  }
};

// Get error message based on error type
function getErrorMessage(error: any) {
  if (!error) return ERROR_MESSAGES.data_error;
  
  const errorMessage = error.message?.toLowerCase() || "";
  
  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return ERROR_MESSAGES.network_error;
  }
  if (errorMessage.includes("timeout") || errorMessage.includes("aborted")) {
    return ERROR_MESSAGES.timeout_error;
  }
  if (errorMessage.includes("500") || errorMessage.includes("internal")) {
    return ERROR_MESSAGES.server_error;
  }
  if (errorMessage.includes("websocket") || errorMessage.includes("socket")) {
    return ERROR_MESSAGES.websocket_error;
  }
  if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
    return ERROR_MESSAGES.api_limit;
  }
  if (errorMessage.includes("parse") || errorMessage.includes("json")) {
    return ERROR_MESSAGES.parsing_error;
  }
  if (errorMessage.includes("401") || errorMessage.includes("403")) {
    return ERROR_MESSAGES.auth_error;
  }
  
  return ERROR_MESSAGES.data_error;
}

// Generic error component
export function ErrorState({ 
  error, 
  onRetry, 
  title, 
  description, 
  className = "" 
}: {
  error?: any;
  onRetry?: () => void;
  title?: string;
  description?: string;
  className?: string;
}) {
  const errorMsg = getErrorMessage(error);
  
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardContent className="p-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-16 w-16 mx-auto text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-400 mb-2" data-testid="error-title">
              {title || errorMsg.title}
            </h3>
            <p className="text-gray-400 mb-4" data-testid="error-description">
              {description || errorMsg.description}
            </p>
          </div>
          {onRetry && (
            <Button 
              onClick={onRetry} 
              variant="outline" 
              className="border-red-500 text-red-400 hover:bg-red-500/10"
              data-testid="button-retry"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {errorMsg.action}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Trading Chart specific error
export function ChartErrorState({ error, onRetry, className = "" }: {
  error?: any;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Grafik Trading
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <BarChart3 className="h-16 w-16 mx-auto text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-400 mb-2" data-testid="chart-error-title">
              Grafik Tidak Dapat Dimuat
            </h3>
            <p className="text-gray-400 mb-4" data-testid="chart-error-description">
              Data chart tidak tersedia. Periksa koneksi internet Anda.
            </p>
          </div>
          {onRetry && (
            <Button 
              onClick={onRetry} 
              variant="outline" 
              className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              data-testid="button-reload-chart"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Muat Ulang Chart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// AI Signal specific error 
export function AIErrorState({ error, onRetry, className = "" }: {
  error?: any;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Trading Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <Brain className="h-16 w-16 mx-auto text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-400 mb-2" data-testid="ai-error-title">
              Analisis AI Tidak Tersedia
            </h3>
            <p className="text-gray-400 mb-4" data-testid="ai-error-description">
              Sistem AI sedang offline atau mengalami gangguan.
            </p>
          </div>
          {onRetry && (
            <Button 
              onClick={onRetry} 
              variant="outline" 
              className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
              data-testid="button-retry-ai"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Analisis AI
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// WebSocket connection error
export function WebSocketErrorState({ onRetry, className = "" }: {
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Alert className={`border-orange-500 bg-orange-500/10 ${className}`}>
      <WifiOff className="h-4 w-4" />
      <AlertTitle className="text-orange-400">
        Koneksi Real-time Terputus
      </AlertTitle>
      <AlertDescription className="text-orange-300">
        Data real-time tidak tersedia. Mencoba menghubungkan kembali...
        {onRetry && (
          <Button 
            onClick={onRetry} 
            variant="link" 
            className="text-orange-400 p-0 h-auto ml-2"
            data-testid="button-reconnect"
          >
            Hubungkan Sekarang
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Data loading timeout warning
export function TimeoutWarning({ onRetry, className = "" }: {
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Alert className={`border-yellow-500 bg-yellow-500/10 ${className}`}>
      <Clock className="h-4 w-4" />
      <AlertTitle className="text-yellow-400">
        Loading Memakan Waktu Lama
      </AlertTitle>
      <AlertDescription className="text-yellow-300">
        Server membutuhkan waktu lebih lama dari biasanya.
        {onRetry && (
          <Button 
            onClick={onRetry} 
            variant="link" 
            className="text-yellow-400 p-0 h-auto ml-2"
            data-testid="button-force-refresh"
          >
            Paksa Refresh
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}