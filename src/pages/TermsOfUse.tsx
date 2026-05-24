import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PreviousPageButton } from "@/components/ui/PreviousPageButton";

const TermsOfUse = () => {
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Terms of Use
          </h1>
          <p className="text-gray-600 mb-8">
            <strong>sitNride</strong> — Operated by Digital Media Connect Pro LLC
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Last Updated: February 1, 2026
          </p>

          {/* Section 1 */}

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Platform Description
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride is a digital technology platform that operates in compliance with South 
              Carolina's Transportation Network Company (TNC) regulations.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride connects riders with independent drivers through its digital platform. 
              sitNride does not provide transportation services, does not operate as a carrier 
              or taxi service, does not employ drivers, and does not own vehicles.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Drivers operate independently and choose when and how they provide services. 
              sitNride's role is limited to facilitating connections, payments, and platform access.
            </p>
          </section>


          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Acceptance of Terms
            </h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using the sitNride platform, users agree to be bound by these 
              Terms of Use. Users must be at least 18 years old or the legal age required to 
              enter into a binding contract.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. User Accounts
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Users must provide accurate and complete information and are responsible for all 
              activity conducted through their account. Users are responsible for maintaining 
              the confidentiality of their login credentials.
            </p>
            <p className="text-gray-700 leading-relaxed">
              sitNride may suspend or terminate accounts for violations of these Terms.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Independent Contractor Status (Drivers)
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All drivers using the sitNride platform are independent contractors and are not 
              employees, agents, or representatives of sitNride or Digital Media Connect Pro LLC.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride does not control drivers' schedules, routes, vehicles, or methods of service.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Drivers are responsible for their own taxes, expenses, insurance, and compliance 
              with applicable laws.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Driver Requirements
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Drivers must maintain a valid driver's license, required insurance, a compliant 
              vehicle, and consent to background checks conducted by third-party providers 
              where applicable.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Drivers must meet all legal and platform eligibility requirements before accepting trips.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Video Cameras & Footage
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Drivers are required to use in-vehicle video cameras for safety purposes. Drivers 
              must clearly inform riders that video recording is in use prior to or at the start 
              of each trip.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Video footage is owned, stored, and maintained by the driver, not sitNride. sitNride 
              does not continuously collect, store, or manage video footage.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride may request access to video footage only in the event of a serious safety 
              incident, dispute, or legal matter.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Drivers are responsible for complying with all applicable recording, privacy, and 
              consent laws.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Payments & Pricing
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All payments on the sitNride platform are processed through the platform using 
              Stripe, a third-party payment processor. sitNride does not store, process, or 
              have direct access to users' full payment card information.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Payment information is handled securely by Stripe in accordance with its own 
              terms and privacy policies.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Cash payments are not permitted. Prices are displayed prior to ride confirmation.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Driver Earnings & Bonuses
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Drivers earn base pay and per-mile pay per ride.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Night Shift Bonus:</strong> Drivers earn a higher base pay for trips that 
              begin between 12:00 AM and 5:00 AM.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Weekend Bonus:</strong> Drivers earn a higher base pay for trips that begin 
              on Saturdays and Sundays.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Bonus pay applies to base pay only and does not modify per-mile rates.
            </p>
            <p className="text-gray-700 leading-relaxed">
              sitNride does not guarantee any minimum earnings, hours, or ride volume.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Rider Responsibilities
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Riders must behave lawfully and respectfully while using the platform. Harassment, 
              abuse, discrimination, or illegal activity is prohibited and may result in account 
              suspension or termination.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. Cancellations, No-Shows, and Refunds
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Riders and drivers may cancel trips through the sitNride platform.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              If a driver fails to arrive for a confirmed trip, the rider may be eligible for a 
              full or partial refund.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              If a rider fails to appear at the pickup location or cancels a trip after a driver 
              has already arrived, the driver may be eligible for compensation.
            </p>
            <p className="text-gray-700 leading-relaxed">
              sitNride may review cancellations, no-shows, and disputes and determine refunds or 
              compensation in accordance with platform rules.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              11. Safety & Reporting
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride provides in-app tools that allow riders and drivers to report safety 
              concerns, incidents, or policy violations. These tools are intended for reporting 
              and review purposes only.
            </p>
            <p className="text-gray-700 leading-relaxed">
              sitNride does not provide emergency services. In the event of an emergency or 
              immediate danger, users are responsible for contacting local emergency services directly.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              12. Limitation of Liability & Indemnification
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride is a technology platform and is not responsible for the actions, conduct, 
              or behavior of riders or drivers.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride is not liable for injuries, damages, losses, or disputes arising from 
              rides or interactions between users, except to the extent required by law.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Users agree to take responsibility for their own actions and to indemnify and hold 
              sitNride and Digital Media Connect Pro LLC harmless from claims, damages, or expenses 
              arising out of their conduct or misuse of the platform.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              13. Modifications & Termination
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              sitNride reserves the right to modify these Terms of Use at any time. Users will 
              be notified of material changes through the platform or via email. Continued use 
              of the platform after changes are posted constitutes acceptance of the updated Terms.
            </p>
            <p className="text-gray-700 leading-relaxed">
              sitNride may suspend or terminate user access to the platform at any time for 
              violations of these Terms or for any other reason at its discretion.
            </p>
          </section>

          {/* Section 14 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              14. Governing Law
            </h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms of Use are governed by and construed in accordance with the laws of 
              the state in which Digital Media Connect Pro LLC is registered, without regard to 
              conflict of law principles.
            </p>
          </section>

          {/* Section 15 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              15. Contact Information
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions about these Terms of Use, please contact us. The only method of contact is email.
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
          </section>


          {/* Divider */}
          <hr className="my-8 border-gray-200" />

          {/* Footer note */}
          <p className="text-sm text-gray-500 text-center">
            By using sitNride, you acknowledge that you have read, understood, and agree to 
            be bound by these Terms of Use.
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

export default TermsOfUse;
