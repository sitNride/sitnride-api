import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Mail } from "lucide-react";
import { PreviousPageButton } from "@/components/ui/PreviousPageButton";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <PreviousPageButton className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors" />
          <Link 
            to="/" 
            className="inline-flex items-center text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </header>


      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          {/* Title */}
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Privacy Policy
            </h1>
          </div>
          <p className="text-gray-600 mb-8">
            <strong>sitNride</strong> — Operated by Digital Media Connect Pro LLC
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Last Updated: February 1, 2026
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <p className="text-gray-700 leading-relaxed">
              Digital Media Connect Pro LLC ("we," "us," or "our") operates the sitNride platform. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
              when you use our mobile application and website (collectively, the "Platform"). Please read 
              this Privacy Policy carefully. By using the Platform, you consent to the data practices 
              described in this policy.
            </p>
          </section>

          {/* Section 1 - Data Collection */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Information We Collect
            </h2>
            
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              1.1 Personal Information
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              When you create an account or use our Platform, we may collect the following personal information:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Profile photo (optional)</li>
              <li>Date of birth (for age verification)</li>
              <li>Driver's license information (for drivers)</li>
              <li>Vehicle information (for drivers)</li>
              <li>Insurance documentation (for drivers)</li>
              <li>Background check consent and results (for drivers)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              1.2 Location Information
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              To provide our ride-sharing services, we collect location data including:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li>Real-time GPS location during active rides</li>
              <li>Pickup and drop-off addresses</li>
              <li>Route information and trip history</li>
              <li>Background location (with your permission) to improve service availability</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can disable location services through your device settings, but this may limit 
              your ability to use certain features of the Platform.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              1.3 Payment Information
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use Stripe, a third-party payment processor, to handle all payment transactions. 
              We do not directly store your complete credit card numbers or bank account details. 
              Payment information we may access includes:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li>Last four digits of payment cards (for display purposes)</li>
              <li>Card type and expiration date</li>
              <li>Billing address</li>
              <li>Transaction history and amounts</li>
              <li>Bank account information for driver payouts (processed through Stripe Connect)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              1.4 Device and Usage Information
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We automatically collect certain information when you use our Platform:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Device type, operating system, and unique device identifiers</li>
              <li>IP address and browser type</li>
              <li>App usage patterns and feature interactions</li>
              <li>Crash reports and performance data</li>
              <li>Communication preferences and settings</li>
            </ul>
          </section>

          {/* Section 2 - How We Use Data */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Provide Services:</strong> To connect riders with drivers, process ride requests, and facilitate transportation services</li>
              <li><strong>Process Payments:</strong> To charge riders for completed trips and pay drivers for their services</li>
              <li><strong>Safety & Security:</strong> To verify user identities, conduct background checks, detect fraud, and ensure platform safety</li>
              <li><strong>Customer Support:</strong> To respond to inquiries, resolve disputes, and provide assistance</li>
              <li><strong>Communications:</strong> To send ride confirmations, receipts, updates, and promotional materials (with your consent)</li>
              <li><strong>Improve Services:</strong> To analyze usage patterns, develop new features, and enhance user experience</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
              <li><strong>Research & Analytics:</strong> To conduct research and generate anonymized, aggregated insights</li>
            </ul>
          </section>

          {/* Section 3 - Third-Party Sharing */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. Information Sharing and Disclosure
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may share your information with the following parties:
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              3.1 Between Riders and Drivers
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              To facilitate rides, we share limited information between riders and drivers, including 
              first names, profile photos, ratings, and real-time location during active trips.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              3.2 Service Providers
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We work with trusted third-party service providers who assist us in operating our Platform:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li><strong>Stripe:</strong> Payment processing and driver payouts</li>
              <li><strong>Mapbox:</strong> Mapping and navigation services</li>
              <li><strong>Background Check Providers:</strong> Driver verification services</li>
              <li><strong>Cloud Hosting:</strong> Data storage and infrastructure (Supabase)</li>
              <li><strong>Analytics Providers:</strong> Usage analysis and performance monitoring</li>
              <li><strong>Communication Services:</strong> Email and SMS notifications</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              3.3 Legal Requirements
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may disclose your information if required to do so by law or in response to valid 
              requests by public authorities (e.g., court orders, subpoenas, government agencies).
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              3.4 Business Transfers
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              In the event of a merger, acquisition, or sale of assets, your information may be 
              transferred to the acquiring entity.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              3.5 With Your Consent
            </h3>
            <p className="text-gray-700 leading-relaxed">
              We may share your information with third parties when you have given us explicit 
              consent to do so.
            </p>
          </section>

          {/* Section 4 - Data Retention */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Data Retention
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We retain your personal information for as long as necessary to fulfill the purposes 
              outlined in this Privacy Policy, unless a longer retention period is required or 
              permitted by law. Specifically:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Account Information:</strong> Retained while your account is active and for up to 7 years after account deletion for legal and regulatory compliance</li>
              <li><strong>Trip History:</strong> Retained for 7 years for tax, legal, and dispute resolution purposes</li>
              <li><strong>Payment Records:</strong> Retained for 7 years as required by financial regulations</li>
              <li><strong>Location Data:</strong> Active trip location data is retained for 90 days; aggregated location data may be retained longer for analytics</li>
              <li><strong>Support Communications:</strong> Retained for 3 years after resolution</li>
              <li><strong>Marketing Preferences:</strong> Retained until you update your preferences or delete your account</li>
            </ul>
          </section>

          {/* Section 5 - User Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Your Rights and Choices
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              5.1 Access Your Data
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You have the right to request a copy of the personal information we hold about you. 
              You can access much of your data directly through your account settings, or you may 
              submit a data access request to our privacy team.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              5.2 Correct Your Data
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can update your personal information through your account settings at any time. 
              If you need assistance correcting information you cannot update yourself, please 
              contact us.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              5.3 Delete Your Data
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may request deletion of your account and personal information. Please note that 
              we may retain certain information as required by law or for legitimate business 
              purposes (such as fraud prevention or resolving disputes). To request account deletion, 
              please contact our support team or use the account deletion option in your settings.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              5.4 Opt-Out of Marketing
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can opt out of receiving promotional communications from us by:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li>Clicking the "unsubscribe" link in any marketing email</li>
              <li>Updating your communication preferences in your account settings</li>
              <li>Contacting our support team</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              Please note that even if you opt out of marketing communications, we may still send 
              you transactional messages related to your account and rides.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              5.5 Location Permissions
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can control location permissions through your device settings. Disabling location 
              services may limit your ability to use ride-related features.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              5.6 Data Portability
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Where applicable, you have the right to receive your personal data in a structured, 
              commonly used, and machine-readable format.
            </p>
          </section>

          {/* Section 6 - Cookies Policy */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Cookies and Tracking Technologies
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to collect and store information 
              about your interactions with our Platform.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              6.1 Types of Cookies We Use
            </h3>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for the Platform to function properly, including authentication and security</li>
              <li><strong>Functional Cookies:</strong> Remember your preferences and settings to enhance your experience</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Platform to improve our services</li>
              <li><strong>Advertising Cookies:</strong> Used to deliver relevant advertisements and measure their effectiveness</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">
              6.2 Managing Cookies
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Most web browsers allow you to control cookies through their settings. You can:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li>Block all cookies</li>
              <li>Accept only first-party cookies</li>
              <li>Delete cookies when you close your browser</li>
              <li>Receive notifications when cookies are being set</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Please note that disabling cookies may affect the functionality of our Platform.
            </p>
          </section>

          {/* Section 7 - Data Security */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Data Security
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We implement appropriate technical and organizational measures to protect your 
              personal information against unauthorized access, alteration, disclosure, or 
              destruction. These measures include:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication protocols</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and employee training</li>
              <li>Incident response procedures</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              While we strive to protect your personal information, no method of transmission 
              over the Internet or electronic storage is 100% secure. We cannot guarantee 
              absolute security.
            </p>
          </section>

          {/* Section 8 - Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Children's Privacy
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The sitNride Platform is not intended for use by individuals under the age of 18. 
              We do not knowingly collect personal information from children under 18 years of age.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you are a parent or guardian and believe that your child has provided us with 
              personal information without your consent, please contact us immediately at{" "}
              <a href="mailto:support@sitNride.net" className="text-emerald-600 hover:text-emerald-700 underline">
                support@sitNride.net
              </a>. If we become aware that we have collected personal information from 
              a child under 18 without verification of parental consent, we will take steps to 
              remove that information from our servers.
            </p>
            <p className="text-gray-700 leading-relaxed">

              Riders under 18 may only use the Platform when accompanied by a parent or legal 
              guardian who has an active sitNride account.
            </p>
          </section>

          {/* Section 9 - International Data Transfers */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. International Data Transfers
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Your information may be transferred to and processed in countries other than your 
              country of residence. These countries may have data protection laws that are 
              different from the laws of your country. We take appropriate safeguards to ensure 
              that your personal information remains protected in accordance with this Privacy 
              Policy, including the use of standard contractual clauses approved by relevant 
              regulatory authorities.
            </p>
          </section>

          {/* Section 10 - California Privacy Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. California Privacy Rights
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you are a California resident, you have additional rights under the California 
              Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
              <li><strong>Right to Know:</strong> You can request information about the categories and specific pieces of personal information we have collected about you</li>
              <li><strong>Right to Delete:</strong> You can request deletion of your personal information, subject to certain exceptions</li>
              <li><strong>Right to Opt-Out:</strong> You can opt out of the "sale" of your personal information (note: we do not sell personal information in the traditional sense)</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          {/* Section 11 - Changes to Privacy Policy */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              11. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our 
              practices or for other operational, legal, or regulatory reasons. We will notify 
              you of any material changes by posting the new Privacy Policy on this page and 
              updating the "Last Updated" date. We encourage you to review this Privacy Policy 
              periodically for any changes. Your continued use of the Platform after any 
              modifications indicates your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* Section 12 - Contact Information */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              12. Contact Us
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or 
              our data practices, please contact us. The only method of contact is email.
            </p>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Company Name:</strong> Digital Media Connect Pro LLC
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Contact Email:</strong>{" "}
                <a 
                  href="mailto:support@sitNride.net" 
                  className="text-emerald-600 hover:text-emerald-700 underline"
                >
                  support@sitNride.net
                </a>
              </p>
              <p className="text-gray-700 leading-relaxed text-sm">
                The only method of contact is email. Please contact us at{" "}
                <a 
                  href="mailto:support@sitNride.net" 
                  className="text-emerald-600 hover:text-emerald-700 underline"
                >
                  support@sitNride.net
                </a>.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed mt-4">
              We will respond to your inquiry within 30 days of receipt.
            </p>
          </section>


          {/* Divider */}
          <hr className="my-8 border-gray-200" />

          {/* Quick Links */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <Link 
              to="/terms" 
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              Terms of Use
            </Link>
            <span className="text-gray-300">|</span>
            <Link 
              to="/contact" 
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              Contact Us
            </Link>
          </div>

          {/* Footer note */}
          <p className="text-sm text-gray-500 text-center">
            By using sitNride, you acknowledge that you have read, understood, and agree to 
            our collection and use of your information as described in this Privacy Policy.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} sitNride. Operated by Digital Media Connect Pro LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
