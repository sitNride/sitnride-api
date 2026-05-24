import { Link } from "react-router-dom";
import { ArrowLeft, Shield, MessageSquare } from "lucide-react";
import { PreviousPageButton } from "@/components/ui/PreviousPageButton";

const SafetyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <PreviousPageButton className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors" />
          <Link
            to="/"
            className="inline-flex items-center text-orange-600 hover:text-orange-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </header>


      {/* Hero Section */}
      <section className="bg-gradient-to-r from-orange-600 to-orange-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Safety Information
          </h1>
          <p className="text-xl text-orange-100 max-w-2xl mx-auto">
            Your safety and comfort are important to us.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Rider Safety Feedback */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Rider Safety Feedback</h2>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Your safety and comfort matter. If at any point during a ride you feel uncomfortable or notice driving behavior that concerns you, such as consistently exceeding the speed limit, you may share that feedback with sitNride after the ride.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Feedback is reviewed to help maintain a safe and respectful experience for everyone on the platform.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Have questions? Email us at{' '}
            <a href="mailto:support@sitNride.net" className="text-orange-600 hover:text-orange-700 underline">
              support@sitNride.net
            </a>.
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/terms" className="text-orange-600 hover:text-orange-700 hover:underline">
              Terms of Use
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/privacy" className="text-orange-600 hover:text-orange-700 hover:underline">
              Privacy Policy
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/contact" className="text-orange-600 hover:text-orange-700 hover:underline">
              Contact Support
            </Link>
          </div>
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

export default SafetyPage;
