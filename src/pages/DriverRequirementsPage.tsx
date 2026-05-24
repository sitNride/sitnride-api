import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Shield, FileText, CheckCircle2, Circle, AlertCircle, Clock } from "lucide-react";
import { PreviousPageButton } from "@/components/ui/PreviousPageButton";



const DriverRequirementsPage = () => {
  const navigate = useNavigate();


  const vehicleRequirements = [
    "Vehicle must be model year 2010 or newer",
    "4-door sedan, SUV, minivan, or crossover (no 2-door vehicles)",
    "Vehicle must be in good working condition with no major cosmetic damage",
    "All safety features must be fully functional (seatbelts, airbags, lights, signals)",
    "Air conditioning and heating must be operational",
    "Drivers are responsible for having their vehicle inspected by a licensed mechanic of the driver's choice. Vehicle must meet safety, insurance, and legal requirements.",

    "Clean interior and exterior maintained at all times",
    "No salvage or rebuilt titles accepted",
    "Vehicle must seat at least 4 passengers (excluding driver)"
  ];

  const insuranceRequirements = [
    "Valid personal auto insurance policy in your name",
    "Minimum liability coverage: $100,000 per person / $300,000 per accident for bodily injury",
    "Minimum property damage coverage: $50,000",
    "Uninsured/Underinsured motorist coverage: Required",
    "Insurance policy must include a rideshare endorsement or equivalent commercial rideshare coverage",

    "Proof of insurance must be current and not expired",
    "Insurance must cover the vehicle used for rideshare",
    "Some states require additional rideshare endorsement or commercial coverage",
    "Insurance documents must match driver and vehicle registration"
  ];

  const legalRequirements = [
    "Valid U.S. driver's license (must have held license for at least 1 year)",
    "Must be at least 21 years of age",
    "Current vehicle registration in your name or authorized to drive",
    "Pass a comprehensive background check (criminal history review)",
    "Pass a driving record check (DMV report review)",
    "No major violations in the past 7 years (DUI, reckless driving, hit-and-run)",
    "No more than 3 minor moving violations in the past 3 years",
    "Must be legally authorized to work in the United States",
    "Consent to ongoing background monitoring"
  ];

  const verificationSteps = [
    {
      step: 1,
      title: "Create Your Account",
      description: "Sign up on the sitNride platform with your email address. Verify your contact information through email confirmation."
    },

    {
      step: 2,
      title: "Submit Personal Information",
      description: "Provide your full legal name, date of birth, Social Security Number (for background check), and current residential address."
    },
    {
      step: 3,
      title: "Upload Driver's License",
      description: "Submit clear photos of the front and back of your valid U.S. driver's license. Ensure all information is legible and the license is not expired."
    },
    {
      step: 4,
      title: "Submit Vehicle Information",
      description: "Enter your vehicle details including make, model, year, color, and license plate number. Upload photos of your vehicle (exterior front, back, sides, and interior)."
    },
    {
      step: 5,
      title: "Upload Vehicle Registration",
      description: "Provide a clear photo of your current vehicle registration. The registration must match the vehicle information submitted and be in your name or show you as an authorized driver."
    },
    {
      step: 6,
      title: "Submit Proof of Insurance",
      description: "Upload your current auto insurance declaration page or insurance card. Coverage must meet minimum requirements and the policy must be active."
    },
    {
      step: 7,
      title: "Background Check Authorization",
      description: "Authorize sitNride to conduct a comprehensive background check through our third-party verification partner. This includes criminal history and sex offender registry checks."
    },
    {
      step: 8,
      title: "Driving Record Review",
      description: "Authorize a DMV driving record check to verify your driving history. We review for major violations, accidents, and overall driving safety record."
    },
    {
      step: 9,
      title: "Final Review & Approval",
      description: "Our team reviews all submitted documents and verification results. Once approved, you'll receive confirmation and can begin accepting ride requests on sitNride."
    }
  ];

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


      {/* Hero Section */}
      <section className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Driver Requirements
          </h1>
          <p className="text-xl text-emerald-100 max-w-2xl mx-auto">
            Everything you need to know before becoming a sitNride driver. Review our requirements and get ready to start earning.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Checklist Summary */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quick Checklist</h2>
              <p className="text-gray-600">Make sure you have these ready before applying</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Valid driver's license (1+ year)</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">At least 21 years old</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Vehicle 2010 or newer</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">4-door vehicle in good condition</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Current vehicle registration</span>
              </label>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Auto insurance (meets minimums)</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Clean driving record</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">No major criminal history</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Smartphone with data plan</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">In-vehicle camera (dashcam)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Vehicle Requirements */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Vehicle Requirements</h2>
              <p className="text-gray-600">Your vehicle must meet these standards</p>
            </div>
          </div>
          
          <ul className="space-y-4">
            {vehicleRequirements.map((requirement, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{requirement}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Vehicle requirements may vary by city or state. Some markets may have additional requirements or allow older vehicle models. Check your local regulations.
              </p>
            </div>
          </div>
        </div>

        {/* In-Vehicle Camera Requirement */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">In-Vehicle Camera Requirement</h2>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              All drivers are required to have a functioning in-vehicle video recording device (dash camera) installed in their vehicle at all times while providing rides through SitNride.
            </p>

            <p className="text-gray-700 leading-relaxed font-semibold">The camera must:</p>
            <ul className="space-y-3 ml-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Record both interior and exterior views when possible</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Be mounted securely and visibly</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Remain powered on during active rides</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Retain recordings for a reasonable period of time</span>
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed mt-4">
              This requirement is implemented to promote safety, accountability, and protection for both drivers and riders.
            </p>

            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-800">
                    <strong>Important:</strong> Failure to maintain a working in-vehicle camera may result in suspension or permanent removal from the platform.
                  </p>
                  <p className="text-sm text-red-800 mt-3">
                    Drivers are solely responsible for maintaining, storing, and safeguarding all recorded footage in a secure manner. Recordings must be preserved in a way that they can be made available when legally required by state or law enforcement officials, or when formally requested by SitNride for safety or compliance investigations.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>


        {/* Insurance Requirements */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Insurance Requirements</h2>
              <p className="text-gray-600">Minimum coverage you must maintain</p>
            </div>
          </div>
          
          <ul className="space-y-4">
            {insuranceRequirements.map((requirement, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{requirement}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-purple-800">
                <strong>Important:</strong> Drivers are responsible for ensuring their personal auto insurance policy allows rideshare activity or includes appropriate rideshare coverage. If a driver's current insurer does not offer rideshare coverage, the driver is required to obtain coverage from an insurer that does before providing rides through SitNride.
              </p>
            </div>
          </div>


          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700">
              Drivers are independent contractors and are responsible for maintaining their own health insurance coverage.
            </p>
            <a
              href="https://www.healthcare.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
            >
              Learn about health coverage options
            </a>
          </div>
        </div>


        {/* Legal Requirements */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Legal Requirements</h2>
              <p className="text-gray-600">Licensing and background requirements</p>
            </div>
          </div>
          
          <ul className="space-y-4">
            {legalRequirements.map((requirement, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{requirement}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Background Check:</strong> Our background checks are conducted by a third-party provider and review criminal history, sex offender registries, and driving records. The process typically takes 3-7 business days. Certain convictions may result in disqualification.
              </p>
            </div>
          </div>
        </div>

        {/* 9-Step Verification Process */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">9-Step Verification Process</h2>
          <p className="text-gray-600 mb-8">Follow these steps to complete your driver application</p>
          
          <div className="space-y-6">
            {verificationSteps.map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connector line */}
                {index < verificationSteps.length - 1 && (
                  <div className="absolute left-6 top-14 w-0.5 h-full bg-gray-200" />
                )}
                
                <div className="flex gap-4">
                  {/* Step number */}
                  <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 relative z-10">
                    {item.step}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Expected Timeline</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-emerald-600 mb-2">10-15 min</div>
              <div className="text-gray-700 font-medium">Application Submission</div>
              <p className="text-sm text-gray-500 mt-2">Time to complete the online application and upload documents</p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-emerald-600 mb-2">3-7 days</div>
              <div className="text-gray-700 font-medium">Background Check</div>
              <p className="text-sm text-gray-500 mt-2">Processing time for criminal and driving record checks</p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-emerald-600 mb-2">1-2 days</div>
              <div className="text-gray-700 font-medium">Final Approval</div>
              <p className="text-sm text-gray-500 mt-2">Document review and account activation</p>
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Tax Information</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Drivers using sitNride are independent contractors, not employees. sitNride does not withhold taxes from driver earnings. Drivers are responsible for reporting and paying their own taxes.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Many independent contractors choose to set aside approximately 20%–30% of their earnings for taxes. Because drivers can access their earnings at any time, it may be helpful to set aside this percentage each time you receive a payout to avoid falling behind at tax time.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Stripe reports driver earnings to the IRS as required by law, and drivers will receive the appropriate tax forms directly from Stripe.
            </p>
          </div>

          {/* What Stripe DOES Do */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What Stripe DOES Do</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              If 1099 tax compliance is enabled on this platform, Stripe will:
            </p>
            <ul className="space-y-3 ml-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Collect required tax information from drivers</span>
              </li>
              <li className="flex items-start gap-3 ml-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Social Security Number (SSN) for individuals</span>
              </li>
              <li className="flex items-start gap-3 ml-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Employer Identification Number (EIN) for businesses</span>
              </li>
              <li className="flex items-start gap-3 ml-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Legal name</span>
              </li>
              <li className="flex items-start gap-3 ml-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Mailing address</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Track each driver's gross earnings on the platform</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Determine which tax form the driver qualifies for</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Generate the official IRS tax form</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">File the appropriate form with the IRS</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Deliver a copy of the form directly to the driver</span>
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Stripe handles tax reporting and form delivery. Drivers do not need to request forms from SitNride.
            </p>
          </div>

          {/* What Stripe DOES NOT Do */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What Stripe DOES NOT Do</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Stripe does NOT:
            </p>
            <ul className="space-y-3 ml-2">
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Withhold federal income taxes</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Withhold state income taxes</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Automatically set aside 20–30% for taxes</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Make tax payments on behalf of drivers</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Issue W-2 forms (drivers are independent contractors, not employees)</span>
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed mt-6 mb-4">
              Drivers are responsible for:
            </p>
            <ul className="space-y-3 ml-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Setting aside their own taxes</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Making quarterly estimated tax payments if required</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Filing their own income taxes</span>
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed mt-6">
              Stripe provides the required 1099 tax form showing total gross earnings for the year. Drivers must use that information when filing their taxes.
            </p>
          </div>
        </div>


        {/* Payout Setup & Stripe Access */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Payout Setup & Stripe Access</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">How driver payouts work</h3>
            <p className="text-gray-700 leading-relaxed">
              After a driver is approved, sitNride uses Stripe, our secure financial services partner, to handle all driver payouts.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Once approved, drivers will receive a secure link to complete their payout setup directly with Stripe. This setup is required before any payouts can be sent.
            </p>
            <p className="text-gray-700 leading-relaxed">Through Stripe, drivers will:</p>
            <ul className="space-y-3 ml-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Enter their bank account information</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Provide required tax information</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Receive access to a Stripe Express dashboard</span>
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed">The Stripe Express dashboard allows drivers to:</p>
            <ul className="space-y-3 ml-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">View payout history</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Track earnings paid out</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Update bank or tax information</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Access tax documents when available</span>
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              For security and privacy reasons, sitNride does not collect, store, or have access to driver bank account or tax information. All sensitive financial data is handled directly by Stripe.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Drivers can access their Stripe Express account at any time using the information provided during setup.
            </p>
          </div>
        </div>



        {/* Driver Safety — Working and Non-Working Hours */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Driver Safety</h2>
              <p className="text-gray-600">Working and Non-Working Hours</p>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <p className="text-gray-700 leading-relaxed">
              For safety, drivers are limited to a maximum of 12 active driving hours within a 24-hour period. After reaching this limit, drivers must take a rest break before going back online. This helps ensure safe and responsible driving for both drivers and riders.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-center">
                <div className="text-2xl font-bold text-orange-600 mb-1">12 hours</div>
                <div className="text-sm text-gray-700 font-medium">Maximum Active Driving</div>
                <p className="text-xs text-gray-500 mt-1">Per 24-hour period</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">6 hours</div>
                <div className="text-sm text-gray-700 font-medium">Minimum Rest Period</div>
                <p className="text-xs text-gray-500 mt-1">Required before resuming</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
                <div className="text-2xl font-bold text-amber-600 mb-1">10 hours</div>
                <div className="text-sm text-gray-700 font-medium">Warning Notification</div>
                <p className="text-xs text-gray-500 mt-1">2 hours before limit</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">How it works</h3>
              <ul className="space-y-3 ml-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">The driving timer starts when you go online or accept your first ride</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">At 10 hours of active driving, you will receive a warning: "You have 2 hours remaining before required rest."</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">After 12 hours of active driving, you will be automatically taken offline and unable to accept new rides</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">You must remain offline for a minimum of 6 hours before you can go back online</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">This rule applies automatically to all drivers on the platform</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-orange-800">
                  <strong>Safety First:</strong> This driving limit is enforced to protect both drivers and riders. Fatigued driving increases the risk of accidents. sitNride is committed to maintaining a safe platform for everyone.
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* CTA Section */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-emerald-100 mb-6 max-w-xl mx-auto">
            If you meet all the requirements above, you're ready to apply. Start driving with sitNride and earn on your own schedule.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/?action=driver-signup')}
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Drive & Earn
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center px-8 py-3 bg-emerald-700 text-white font-semibold rounded-lg border-2 border-emerald-300 hover:bg-emerald-800 transition-colors"
            >
              Back to Home
            </button>
          </div>




        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Have questions about the requirements? Email us at{' '}
            <a href="mailto:support@sitNride.net" className="text-emerald-600 hover:text-emerald-700 underline">
              support@sitNride.net
            </a>.
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/terms" className="text-emerald-600 hover:text-emerald-700 hover:underline">
              Terms of Use
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/privacy" className="text-emerald-600 hover:text-emerald-700 hover:underline">
              Privacy Policy
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/contact" className="text-emerald-600 hover:text-emerald-700 hover:underline">
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

export default DriverRequirementsPage;

