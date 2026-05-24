import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle, Car, Users, Info } from "lucide-react";
import { PreviousPageButton } from "@/components/ui/PreviousPageButton";


interface FAQItem {
  question: string;
  answer: string | string[];
}

interface FAQSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: FAQItem[];
}

const faqSections: FAQSection[] = [
  {
    title: "For Riders",
    icon: <Users className="w-6 h-6 text-orange-600" />,
    color: "orange",
    items: [
      {
        question: "How do I request a ride?",
        answer:
          "You can request a ride by entering your pickup and dropoff location in the fare estimator. You will also need to enter the estimated distance (miles) and time (minutes) for your trip. This information can be obtained from your phone's map or GPS. Once all details are entered, you can review the estimated cost and confirm your ride.",
      },
      {
        question: "How is my fare calculated?",
        answer:
          "Your fare is based on a combination of a base rate, distance (per mile), and time (per minute). All pricing is shown upfront before you confirm your ride.",
      },
      {
        question: "Can I share a ride with others?",
        answer:
          "Yes. sitNride allows multiple riders to share a trip and split the total cost. The price is divided evenly among all confirmed riders.",
      },
      {
        question: "When am I charged for a ride?",
        answer: [
          "For individual riders, payment is confirmed when you agree to the ride and proceed with booking.",
          "For shared rides, each rider must confirm their payment individually before the ride is finalized. This ensures the trip is secured before it begins.",
        ],
      },
    ],
  },
  {
    title: "For Drivers",
    icon: <Car className="w-6 h-6 text-green-600" />,
    color: "green",
    items: [
      {
        question: "How do I sign up to drive?",
        answer:
          'Click the "Drive & Earn" button anywhere on the platform and complete the signup form. You must meet all driver requirements before being approved.',
      },
      {
        question: "How do drivers get paid?",
        answer:
          "Drivers are paid through our secure payment partner, Stripe. Earnings from completed rides are processed and transferred through Stripe. sitNride does not hold or store driver funds or sensitive payment information.",
      },
      {
        question: "What percentage do drivers earn?",
        answer:
          "Drivers typically earn around 75% of the total fare. sitNride earns money through a platform fee, which includes a portion of the base fare as well as a percentage of the distance-based (mileage) portion of each trip.",
      },
      {
        question: "What are the requirements to become a driver?",
        answer: [
          "Drivers must have a valid driver's license, active insurance, a completed vehicle inspection, and a dash cam for safety and documentation.",
          "For full details, make sure to check the Driver Requirements page.",
        ],
      },
    ],
  },
  {
    title: "General Questions",
    icon: <Info className="w-6 h-6 text-purple-600" />,
    color: "purple",
    items: [
      {
        question: "Is sitNride a transportation company?",
        answer:
          "No. sitNride is a technology platform that connects riders with independent drivers.",
      },
      {
        question: "How does sitNride make money?",
        answer:
          "sitNride earns a percentage from each completed ride as a platform service fee.",
      },
      {
        question: "Who do I contact for support?",
        answer:
          "You can reach support through the Contact Us section on the website.",
      },
    ],
  },
];

const AccordionItem = ({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) => {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-base font-semibold text-gray-900 pr-4">{item.question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-6 pb-5 bg-white">
          <div className="border-t border-gray-100 pt-4">
            {Array.isArray(item.answer) ? (
              <div className="space-y-3">
                {item.answer.map((paragraph, idx) => {
                  // Check if paragraph mentions "Driver Requirements page" to add a link
                  if (paragraph.includes("Driver Requirements page")) {
                    const parts = paragraph.split("Driver Requirements page");
                    return (
                      <p key={idx} className="text-gray-700 leading-relaxed">
                        {parts[0]}
                        <Link
                          to="/driver-requirements"
                          className="text-orange-600 hover:text-orange-700 underline font-medium"
                        >
                          Driver Requirements page
                        </Link>
                        {parts[1]}
                      </p>
                    );
                  }
                  return (
                    <p key={idx} className="text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-700 leading-relaxed">{item.answer}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FAQHelpCenterPage = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (sectionIdx: number, itemIdx: number) => {
    const key = `${sectionIdx}-${itemIdx}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionColorMap: Record<string, { bg: string; border: string; iconBg: string }> = {
    orange: { bg: "bg-orange-50", border: "border-orange-200", iconBg: "bg-orange-100" },
    green: { bg: "bg-green-50", border: "border-green-200", iconBg: "bg-green-100" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", iconBg: "bg-purple-100" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">FAQ Help Center</h1>
          <p className="text-xl text-orange-100 max-w-2xl mx-auto">
            Find answers to commonly asked questions about sitNride.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {faqSections.map((section, sectionIdx) => {
            const colors = sectionColorMap[section.color] || sectionColorMap.orange;
            return (
              <div key={sectionIdx}>
                {/* Section Heading */}
                <div className={`flex items-center gap-3 mb-6 p-4 ${colors.bg} rounded-xl border ${colors.border}`}>
                  <div className={`w-10 h-10 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                    {section.icon}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
                </div>

                {/* Accordion Items */}
                <div className="space-y-3">
                  {section.items.map((item, itemIdx) => (
                    <AccordionItem
                      key={itemIdx}
                      item={item}
                      isOpen={!!openItems[`${sectionIdx}-${itemIdx}`]}
                      onToggle={() => toggleItem(sectionIdx, itemIdx)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Still have questions? Reach out to us anytime.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/contact" className="text-orange-600 hover:text-orange-700 hover:underline">
              Contact Us
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/safety" className="text-orange-600 hover:text-orange-700 hover:underline">
              Safety
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/driver-requirements" className="text-orange-600 hover:text-orange-700 hover:underline">
              Driver Requirements
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

export default FAQHelpCenterPage;
