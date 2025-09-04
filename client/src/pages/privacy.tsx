import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">
              Last Updated: September 4, 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground mb-2">
                Our SOL Trading Analyst service collects minimal information to provide trading analysis:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>IP addresses for rate limiting (not stored permanently)</li>
                <li>API request logs for system monitoring (retained for 7 days)</li>
                <li>No personal information or trading account data is collected</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. How We Use Information</h2>
              <p className="text-muted-foreground">
                The limited information we collect is used solely for:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Preventing API abuse through rate limiting</li>
                <li>Monitoring system performance and uptime</li>
                <li>Debugging technical issues</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Data Sources</h2>
              <p className="text-muted-foreground">
                All trading data displayed is sourced from:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>OKX Exchange public market data APIs</li>
                <li>Real-time WebSocket feeds for price updates</li>
                <li>No user trading accounts or wallets are accessed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
              <p className="text-muted-foreground">
                We integrate with the following third-party services:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>OKX Exchange - for market data only (no account access)</li>
                <li>OpenAI GPT - when used through ChatGPT custom GPTs</li>
                <li>Replit - for hosting infrastructure</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>HTTPS encryption for all API communications</li>
                <li>Rate limiting to prevent abuse</li>
                <li>No storage of sensitive personal or financial data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. User Rights</h2>
              <p className="text-muted-foreground">
                As we collect minimal data, users have the right to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Access our public API documentation</li>
                <li>Use the service without providing personal information</li>
                <li>Stop using the service at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
              <p className="text-muted-foreground">
                We do not use cookies or tracking technologies. The service operates entirely through stateless API requests.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our service is not intended for users under 18 years of age. We do not knowingly collect information from children.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. Any changes will be reflected on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about this privacy policy or our data practices, please contact us through:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Website: guardiansofthegreentoken.com</li>
                <li>Service: SOL Trading Analyst API</li>
              </ul>
            </section>

            <section className="pt-6 border-t">
              <p className="text-sm text-muted-foreground italic">
                This privacy policy applies to the SOL Trading Analyst API service and any ChatGPT custom GPTs that integrate with our API endpoints.
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>© 2025 SOL Trading Analyst. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}