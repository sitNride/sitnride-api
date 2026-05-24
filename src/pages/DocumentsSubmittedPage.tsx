import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  ClockIcon,
  ShieldIcon,
  FileTextIcon,
  MailIcon,
} from '@/components/ui/Icons';

const DocumentsSubmittedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-gray-900">
            sit<span className="text-orange-600">N</span>ride
          </span>
        </div>

        {/* Main Confirmation Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircleIcon className="text-green-600" size={40} />
          </div>

          {/* Page Title */}
          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            Documents Submitted
          </h1>

          {/* Confirmation Message */}
          <p className="mt-4 text-gray-600 max-w-md mx-auto">
            Your documents have been successfully submitted.
          </p>
          <p className="mt-2 text-gray-600 max-w-md mx-auto">
            Our team will review your information and notify you once your
            application has been approved.
          </p>

          {/* Status Section */}
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center justify-center gap-3">
              <ClockIcon className="text-amber-600" size={24} />
              <div>
                <p className="text-sm text-amber-700 font-medium">Status:</p>
                <p className="text-lg font-bold text-amber-800">
                  Pending Approval
                </p>
              </div>
            </div>
          </div>

          {/* What Happens Next Section */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-4">
              What happens next?
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileTextIcon className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Document Review</p>
                  <p className="text-sm text-gray-600">
                    Our team will carefully verify all uploaded documents.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldIcon className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Background Check</p>
                  <p className="text-sm text-gray-600">
                    A background check will be initiated (3–7 business days).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MailIcon className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Approval Notification
                  </p>
                  <p className="text-sm text-gray-600">
                    You'll receive an email when your account is approved and
                    ready to go.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps Message */}
          <p className="mt-6 text-sm text-gray-500">
            You can return to the homepage or wait for approval before
            continuing.
          </p>

          {/* Back to Homepage Button */}
          <button
            onClick={() => navigate('/')}
            className="mt-6 w-full py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all"
          >
            Back to Homepage
          </button>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            sitNride is a technology platform connecting riders with independent
            drivers. sitNride does not provide transportation services.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentsSubmittedPage;
