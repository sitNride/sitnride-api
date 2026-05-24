import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PreviousPageButton } from "@/components/ui/PreviousPageButton";

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <PreviousPageButton className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors" />
          <Link
            to="/"
            className="inline-flex items-center text-emerald-600 hover:text-emerald-700 transition-colors font-medium"
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>


      {/* Hero Section — Text Only */}
      <section className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About SitNride</h1>
          <p className="text-xl md:text-2xl text-emerald-100 max-w-3xl mx-auto">
            Connecting communities through safe, reliable, and fair rideshare
            services
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Mission */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 mb-8">
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Our Mission
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              SitNride exists to provide safe, affordable, and reliable
              transportation to communities that have been historically
              underserved by traditional rideshare platforms. We believe that
              access to transportation is access to opportunity—and everyone
              deserves both.
            </p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Our Vision
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              We envision a world where every neighborhood has access to safe,
              dependable rides at fair prices—where drivers are valued independent
              partners who earn fair compensation, and where technology serves to strengthen
              communities rather than exploit them.

            </p>
          </section>
        </div>

        {/* The Problem We Solve */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 mb-8">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              The Problem We're Solving
            </h2>
            <div className="space-y-6 text-gray-700 leading-relaxed">
              <p>
                For too long, rideshare services have overlooked entire
                communities. Areas outside major urban centers often face longer
                wait times, fewer available drivers, and inconsistent service.
                Meanwhile, drivers in these areas struggle to earn sustainable
                incomes due to unfair commission structures and unpredictable
                algorithms.
              </p>
              <p>
                Traditional rideshare platforms optimize for volume and profit
                margins, often at the expense of the communities and drivers they
                claim to serve. Surge pricing exploits moments of high demand.
                Opaque algorithms leave drivers guessing about their earnings.
                And underserved neighborhoods are left waiting—or worse, ignored
                entirely.
              </p>
              <p className="font-semibold text-emerald-700">
                SitNride was built to change this. We're not just another
                rideshare app—we're a community-focused platform designed from
                the ground up to serve the areas and people that others have left
                behind.
              </p>
            </div>
          </section>
        </div>

        {/* Founding Story */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 mb-8">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Our Story
            </h2>
            <div className="space-y-6 text-gray-700 leading-relaxed">
              <p>
                SitNride was founded by Leroy James after witnessing firsthand
                the transportation challenges facing communities across the
                country. Growing up in an area where public transit was limited
                and rideshare services were unreliable, Leroy understood that
                lack of transportation meant lack of opportunity.
              </p>
              <p>
                After spending years observing the transportation industry, Leroy
                saw how technology could either bridge gaps or widen them. He
                watched as major rideshare companies prioritized profitable urban
                markets while leaving suburban and rural communities behind. He
                saw drivers struggling to make ends meet despite working long
                hours. He knew there had to be a better way.
              </p>
              <p>
                Leroy founded Digital Media Connect Pro LLC and launched SitNride
                with a simple but powerful idea: what if a rideshare platform was
                designed to serve communities first? What if drivers were treated
                as true partners? What if transparency and fairness weren't just
                marketing buzzwords, but core operating principles?
              </p>
              <p>
                Today, SitNride is growing across underserved markets, connecting
                riders with reliable transportation and providing drivers with
                fair earning opportunities. We're proving that a different model
                is possible—one where technology serves people, not the other way
                around.
              </p>
            </div>
          </section>
        </div>

        {/* Our Values — Text Only, No Icons */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 mb-8">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
              Our Values
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-6 bg-gray-50 rounded-xl">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Community First
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  We believe transportation is a community service. Every
                  decision we make considers the impact on the neighborhoods we
                  serve, prioritizing local drivers and the unique needs of each
                  community.
                </p>
              </div>
              <div className="p-6 bg-gray-50 rounded-xl">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Safety Always
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Safety isn't just a feature—it's our foundation. From
                  comprehensive background checks to real-time monitoring, we've
                  built multiple layers of protection for every ride.
                </p>
              </div>
              <div className="p-6 bg-gray-50 rounded-xl">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Fairness for All
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Drivers deserve fair compensation for their work. We maintain
                  transparent pricing, ensure drivers keep more of their
                  earnings, and never use surge pricing that exploits high-demand
                  moments.
                </p>
              </div>
              <div className="p-6 bg-gray-50 rounded-xl">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Radical Transparency
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  No hidden fees, no surprise charges, no opaque algorithms. We
                  believe riders and drivers deserve to know exactly how pricing
                  works and where their money goes.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Leadership — Text Only, No Photos, No Images */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 mb-8">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Leadership
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                <strong>Owner &amp; CEO:</strong> Leroy James
              </p>
              <p>
                <strong>Company:</strong> Digital Media Connect Pro LLC
              </p>
              <p>
                Leroy James leads SitNride with a vision of equitable
                transportation for all communities. Under his leadership,
                SitNride continues to expand its reach, connecting riders with
                reliable drivers and building a platform rooted in fairness,
                safety, and transparency.
              </p>
            </div>
          </section>
        </div>

        {/* Company Info & Contact — Email Only, No Address, No Phone */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 mb-8">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              About Digital Media Connect Pro LLC
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                SitNride is owned and operated by{" "}
                <strong>Digital Media Connect Pro LLC</strong>, a technology
                company focused on building platforms that connect people and
                strengthen communities.
              </p>
              <p>
                Digital Media Connect Pro LLC is committed to developing
                innovative solutions that address real-world challenges while
                maintaining the highest standards of ethics, transparency, and
                user privacy.
              </p>
              <div className="bg-gray-50 rounded-lg p-6 mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Contact Information
                </h3>
                <p className="text-gray-600 mb-2">
                  <strong>Company:</strong> Digital Media Connect Pro LLC
                </p>
                <p className="text-gray-600 mb-4">
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:support@sitNride.net"
                    className="text-emerald-600 hover:text-emerald-700 underline"
                  >
                    support@sitNride.net
                  </a>
                </p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-gray-700 font-medium">
                    SitNride can be contacted exclusively by email at{" "}
                    <a
                      href="mailto:support@sitNride.net"
                      className="text-emerald-600 hover:text-emerald-700 underline"
                    >
                      support@sitNride.net
                    </a>
                    .
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    The only method of contact is email. No phone, mail, or
                    in-person contact methods are available.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Call to Action — Text Only */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg shadow-lg p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Join the SitNride Community
          </h2>
          <p className="text-emerald-100 mb-8 max-w-2xl mx-auto">
            Whether you're looking for reliable rides or want to earn money on
            your own schedule, SitNride is here for you. Join thousands of
            riders and drivers who are already experiencing a better way to get
            around.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <Button
                size="lg"
                className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-8"
              >
                Become a Rider &rarr;
              </Button>
            </Link>
            <Link to="/">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white/10 font-semibold px-8"
              >
                Drive with SitNride &rarr;
              </Button>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-12 border-gray-200" />

        {/* Quick Links & Contact Reminder */}
        <div className="text-center">
          <p className="text-gray-600 mb-2">
            Have questions? SitNride can be contacted exclusively by email at{" "}
            <a
              href="mailto:support@sitNride.net"
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              support@sitNride.net
            </a>
            .
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <Link
              to="/contact"
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Contact Us
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              to="/terms"
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Terms of Use
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              to="/privacy"
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            &copy; {new Date().getFullYear()} SitNride. Operated by Digital
            Media Connect Pro LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
