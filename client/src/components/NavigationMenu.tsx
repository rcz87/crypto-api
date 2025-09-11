import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  TrendingUp, 
  BarChart3, 
  DollarSign, 
  Target, 
  Zap, 
  Brain, 
  Database, 
  Settings,
  ChevronDown,
  Activity,
  Layers,
  Menu,
  X
} from 'lucide-react';

interface NavigationMenuProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const NavigationMenu = ({ activeSection, onSectionChange }: NavigationMenuProps) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const menuItems = [
    {
      id: 'pasar',
      label: 'Pasar',
      icon: <TrendingUp className="w-4 h-4" />,
      items: [
        { id: 'overview', label: 'Status Overview', description: 'System health & metrics' },
        { id: 'tradingview', label: 'Chart Utama', description: 'TradingView professional chart' },
        { id: 'realtime', label: 'Data Real-time', description: 'Live market data streaming' },
        { id: 'multi-coin', label: 'Multi-Coin Screening', description: 'Cross-pair analysis' }
      ]
    },
    {
      id: 'analisis',
      label: 'Analisis Teknis',
      icon: <BarChart3 className="w-4 h-4" />,
      items: [
        { id: 'technical-indicators', label: 'Indikator Teknis', description: 'RSI, EMA, MACD analysis' },
        { id: 'fibonacci', label: 'Fibonacci Analysis', description: 'Professional retracements' },
        { id: 'confluence', label: 'Confluence Scoring', description: '8-layer confluence system' },
        { id: 'mtf-analysis', label: 'Multi-Timeframe', description: 'MTF intelligence analysis' }
      ]
    },
    {
      id: 'minat-terbuka',
      label: 'Minat Terbuka',
      icon: <Target className="w-4 h-4" />,
      items: [
        { id: 'open-interest', label: 'Enhanced Open Interest', description: 'Institutional positioning' },
        { id: 'oi-analysis', label: 'OI Sentiment Analysis', description: 'Open interest trends' }
      ]
    },
    {
      id: 'funding',
      label: 'Tingkat Pendanaan',
      icon: <DollarSign className="w-4 h-4" />,
      items: [
        { id: 'funding-rate', label: 'Enhanced Funding Rate', description: 'Premium funding analysis' },
        { id: 'funding-trends', label: 'Funding Trends', description: 'Historical funding patterns' }
      ]
    },
    {
      id: 'likuidasi',
      label: 'Likuidasi',
      icon: <Zap className="w-4 h-4" />,
      items: [
        { id: 'liquidity-heatmap', label: 'Liquidity Heatmap', description: 'VIP8+ cascade analysis' },
        { id: 'order-flow', label: 'Order Flow Analysis', description: 'Market microstructure' }
      ]
    },
    {
      id: 'volume',
      label: 'Volume',
      icon: <Activity className="w-4 h-4" />,
      items: [
        { id: 'volume-profile', label: 'Enhanced Volume Profile', description: 'VPOC & value areas' },
        { id: 'cvd-analysis', label: 'CVD Analysis', description: 'Smart money volume delta' },
        { id: 'volume-delta', label: 'Volume Delta', description: 'Buy/sell pressure analysis' }
      ]
    },
    {
      id: 'ai-trading',
      label: 'AI Trading',
      icon: <Brain className="w-4 h-4" />,
      items: [
        { id: 'enhanced-ai', label: 'Enhanced AI Engine', description: 'Phase 2 neural network' },
        { id: 'ai-signals', label: 'AI Signal Dashboard', description: 'Advanced pattern detection' },
        { id: 'live-signals', label: 'Live Trading Signals', description: 'Real-time entry/exit points' }
      ]
    },
    {
      id: 'smart-money',
      label: 'Smart Money',
      icon: <Layers className="w-4 h-4" />,
      items: [
        { id: 'smc-analysis', label: 'SMC Analysis', description: 'Smart Money Concepts' },
        { id: 'whale-tracking', label: 'Whale Tracking', description: 'Large order detection' }
      ]
    },
    {
      id: 'data',
      label: 'Data',
      icon: <Database className="w-4 h-4" />,
      items: [
        { id: 'api-docs', label: 'API Documentation', description: 'Complete endpoint docs' },
        { id: 'system-logs', label: 'System Logs', description: 'Real-time monitoring' }
      ]
    },
    {
      id: 'konfigurasi',
      label: 'Konfigurasi',
      icon: <Settings className="w-4 h-4" />,
      items: [
        { id: 'configuration', label: 'Configuration Panel', description: 'System settings' },
        { id: 'preferences', label: 'User Preferences', description: 'Customize interface' }
      ]
    }
  ];

  // Mobile Navigation Component
  const MobileNavigation = () => (
    <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="md:hidden p-2 h-10 w-10 relative z-50"
          data-testid="button-toggle-nav"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="w-80 h-full max-w-none bg-white p-0 sm:max-w-sm fixed left-0 top-0 translate-x-0 translate-y-0 sm:translate-x-0 sm:translate-y-0 overflow-hidden flex flex-col z-50"
        data-testid="dialog-navigation"
      >
        <DialogHeader className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-1.5 rounded-lg">
                <Database className="w-4 h-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-gray-900">
                CryptoSat Intelligence
              </DialogTitle>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="mobile-menu-close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </DialogHeader>
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {menuItems.map((menu) => (
            <div key={menu.id} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 rounded-lg">
                {menu.icon}
                {menu.label}
              </div>
              {menu.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSectionChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                    activeSection === item.id 
                      ? 'bg-blue-50 text-blue-900 border border-blue-200' 
                      : 'hover:bg-gray-50 active:bg-gray-100 text-gray-700'
                  }`}
                  data-testid={`mobile-nav-${item.id}`}
                >
                  <div className="flex flex-col space-y-1">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">CryptoSat Intelligence</h1>
              <h1 className="text-base font-semibold text-gray-900 sm:hidden">CryptoSat</h1>
            </div>
          </div>

          {/* Desktop Navigation Menu */}
          {!isMobile && (
            <div className="hidden md:flex items-center space-x-1">
              {menuItems.map((menu) => (
                <DropdownMenu 
                  key={menu.id}
                  open={openDropdown === menu.id}
                  onOpenChange={(open) => setOpenDropdown(open ? menu.id : null)}
                >
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant={activeSection.startsWith(menu.id) ? "default" : "ghost"}
                      size="sm"
                      className={`h-10 px-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                        activeSection.startsWith(menu.id) 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      data-testid={`nav-${menu.id}`}
                    >
                      {menu.icon}
                      {menu.label}
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-80 bg-white border border-gray-200 shadow-lg"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-gray-900 bg-gray-50">
                      {menu.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {menu.items.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => {
                          onSectionChange(item.id);
                          setOpenDropdown(null);
                        }}
                        className={`px-3 py-3 cursor-pointer transition-colors ${
                          activeSection === item.id 
                            ? 'bg-blue-50 text-blue-900' 
                            : 'hover:bg-gray-50'
                        }`}
                        data-testid={`nav-item-${item.id}`}
                      >
                        <div className="flex flex-col space-y-1">
                          <div className="font-medium text-sm text-gray-900">
                            {item.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.description}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </div>
          )}

          {/* Mobile Menu + Status Indicators */}
          <div className="flex items-center space-x-3">
            {/* Mobile Navigation */}
            <MobileNavigation />
            
            {/* Status Indicators */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center space-x-2 px-2 sm:px-3 py-1 rounded-full bg-green-50">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-green-700">Live</span>
              </div>
              <div className="hidden sm:block text-xs text-gray-500">guardiansofthegreentoken.com</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};