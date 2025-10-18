import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
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
            <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            <p className="text-muted-foreground">
              Last Updated: September 4, 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using the SOL Trading Analyst API service, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Service Description</h2>
              <p className="text-muted-foreground mb-2">
                SOL Trading Analyst provides:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Real-time SOL/USDT market data analysis</li>
                <li>Trading signals and technical indicators</li>
                <li>Smart Money Concepts analysis</li>
                <li>API access for integration with trading tools and ChatGPT</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Disclaimer of Investment Advice</h2>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-muted-foreground font-semibold">
                  IMPORTANT: This service provides data analysis tools only. It does NOT constitute investment advice, 
                  financial advice, trading advice, or any other sort of advice. Trading cryptocurrency carries significant risk 
                  and can result in the loss of your capital. Always do your own research and consult with qualified financial advisors.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Use Restrictions</h2>
              <p className="text-muted-foreground mb-2">
                You agree not to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Exceed rate limits (100 requests per minute)</li>
                <li>Use the service for illegal activities</li>
                <li>Attempt to disrupt or overload the service</li>
                <li>Resell or redistribute our data without permission</li>
                <li>Misrepresent the service as your own</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of the SOL Trading Analyst service are owned by us and are protected 
                by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. API Usage</h2>
              <p className="text-muted-foreground mb-2">
                When using our API:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Respect rate limits to ensure fair usage</li>
                <li>Include proper attribution when displaying our data</li>
                <li>Do not modify or misrepresent the data</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
                CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR 
                INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. No Warranty</h2>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. 
                We do not guarantee that the service will be uninterrupted, secure, or error-free.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from your use of the service, 
                your violation of these terms, or your violation of any rights of another party.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to terminate or suspend access to our service immediately, without prior notice, 
                for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with applicable laws, 
                without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify or replace these Terms at any time. 
                Continued use of the service after any such changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about these Terms of Service:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Website: guardiansofthetoken.com</li>
                <li>Service: SOL Trading Analyst API</li>
              </ul>
            </section>

            <section className="pt-6 border-t">
              <p className="text-sm text-muted-foreground italic">
                By using the SOL Trading Analyst API or any ChatGPT custom GPTs integrated with our service, 
                you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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