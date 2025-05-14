import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ExternalApiDocsPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/docs/api">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">External API Documentation</h1>
          <p className="text-muted-foreground">
            Reference documentation for integrating external lead forms with the Compliance Engine
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <div className="space-y-4">
          <div className="font-medium">API Reference</div>
          <nav className="flex flex-col space-y-1">
            <Link href="#lead-submission" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Lead Submission
            </Link>
            <Link href="#authentication" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Authentication
            </Link>
            <Link href="#cors" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              CORS Configuration
            </Link>
            <Link href="#implementation" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Implementation Guide
            </Link>
            <Link href="#testing" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Testing
            </Link>
          </nav>
        </div>

        <div className="space-y-6">
          <Card id="lead-submission">
            <CardHeader>
              <CardTitle>Lead Submission</CardTitle>
              <CardDescription>Submit lead data with TrustedForm certificates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST https://compliance.juicedmedia.io/api/v1/leads</p>
              </div>

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`Content-Type: application/json
Api-Key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+15551234567",
  "certificateUrl": "https://cert.trustedform.com/2b1cb000fd39cf01c66513cb37175985c28c955e",
  "source": "https://yourleadsite.com/form-page",
  "formName": "Insurance Quote Form",
  "verifyImmediately": true
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Parameters</h3>
                    <div className="mt-1 rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-2 text-left font-medium">Parameter</th>
                            <th className="p-2 text-left font-medium">Type</th>
                            <th className="p-2 text-left font-medium">Required</th>
                            <th className="p-2 text-left font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 font-mono">firstName</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No</td>
                            <td className="p-2">First name of the lead</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">lastName</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No</td>
                            <td className="p-2">Last name of the lead</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">email</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No*</td>
                            <td className="p-2">Email address of the lead</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">phone</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No*</td>
                            <td className="p-2">Phone number in E.164 format</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">certificateUrl</td>
                            <td className="p-2">string</td>
                            <td className="p-2">Yes</td>
                            <td className="p-2">TrustedForm certificate URL</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">source</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No</td>
                            <td className="p-2">URL of the form page</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">formName</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No</td>
                            <td className="p-2">Name of the form</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-mono">verifyImmediately</td>
                            <td className="p-2">boolean</td>
                            <td className="p-2">No</td>
                            <td className="p-2">Whether to verify the certificate immediately</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">* Either email or phone is required</p>
                  </div>
                </TabsContent>
                <TabsContent value="response" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "message": "Lead and TrustedForm certificate captured successfully",
  "certificateId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "verificationResult": {
    "success": true,
    "status": "verified",
    "matchStatus": true
  }
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Error Response (400 Bad Request)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "error": "Invalid TrustedForm certificate URL format"
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="authentication">
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>How to authenticate with the API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">All API requests must include your API key in the Api-Key header:</p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">Api-Key: YOUR_API_KEY</code>
              </pre>
              <p className="text-sm">
                You can obtain an API key from the{" "}
                <Link href="/api-keys" className="text-primary underline">
                  API Keys
                </Link>{" "}
                page.
              </p>
            </CardContent>
          </Card>

          <Card id="cors">
            <CardHeader>
              <CardTitle>CORS Configuration</CardTitle>
              <CardDescription>Cross-Origin Resource Sharing setup for external domains</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                The API is configured to accept cross-origin requests from approved domains. If you need to add your
                domain to the allowed list, please contact support.
              </p>
              <div>
                <h3 className="text-sm font-medium">Allowed Headers</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">Content-Type, Authorization, Api-Key</code>
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium">Allowed Methods</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">GET, POST, PUT, DELETE, OPTIONS</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card id="implementation">
            <CardHeader>
              <CardTitle>Implementation Guide</CardTitle>
              <CardDescription>How to implement TrustedForm in your lead forms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">1. Add TrustedForm Script</h3>
                <p className="text-sm mt-1">Add this script to your form page, just before the closing body tag:</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`<!-- TrustedForm -->
<script type="text/javascript">
(function() {
  var field = 'xxTrustedFormCertUrl';
  var tf = document.createElement('script');
  tf.type = 'text/javascript';
  tf.async = true;
  tf.src = ('https:' == document.location.protocol ? 'https://' : 'http://') + 
    'api.trustedform.com/trustedform.js?field=' + field + 
    '&ping_field=xxTrustedFormPingUrl&l=' + 
    new Date().getTime() + Math.random();
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(tf, s);
})();
</script>
<noscript>
  <img src="https://api.trustedform.com/ns.gif" />
</noscript>
<!-- End TrustedForm -->`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">2. Add Hidden Field to Form</h3>
                <p className="text-sm mt-1">Add this hidden field to your form:</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`<input type="hidden" name="xxTrustedFormCertUrl" id="xxTrustedFormCertUrl" value="">`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">3. Submit Form Data to Compliance Engine</h3>
                <p className="text-sm mt-1">Example JavaScript for submitting form data:</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`document.getElementById('lead-form').addEventListener('submit', function(event) {
  event.preventDefault();
  
  // Get form data
  const formData = new FormData(this);
  
  // Extract lead and TrustedForm data
  const leadData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    source: window.location.href,
    formName: 'Your Form Name',
    certificateUrl: formData.get('xxTrustedFormCertUrl'),
    verifyImmediately: true
  };
  
  // Send to compliance engine
  fetch('https://compliance.juicedmedia.io/api/v1/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': 'YOUR_API_KEY'
    },
    body: JSON.stringify(leadData),
    mode: 'cors'
  })
  .then(response => response.json())
  .then(data => {
    console.log('Compliance data sent successfully');
    // Continue with normal form submission if needed
    this.submit();
  })
  .catch(error => {
    console.error('Error sending to compliance engine:', error);
    // Still submit the form to avoid disrupting the user experience
    this.submit();
  });
});`}
                  </code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card id="testing">
            <CardHeader>
              <CardTitle>Testing</CardTitle>
              <CardDescription>How to test your integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                To test your integration, you can use the following TrustedForm test certificate URL:
              </p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">
                  https://cert.trustedform.com/2605ec3870ea310c85270a62a2f766b8bfa3976f
                </code>
              </pre>
              <p className="text-sm">
                This is a valid certificate URL that can be used for testing purposes. When using this URL, the
                verification will always succeed, but no actual verification will be performed.
              </p>
              <p className="text-sm mt-4">To verify your integration is working correctly:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Submit a test lead with the test certificate URL</li>
                <li>Check the response from the API</li>
                <li>Verify the lead appears in the compliance engine dashboard</li>
                <li>Check that the certificate was captured correctly</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
