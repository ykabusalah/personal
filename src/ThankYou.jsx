import { useEffect } from 'react';

// Google Analytics tracking function
const trackEvent = (eventName, parameters = {}) => {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, parameters);
    console.log('📊 GA Event:', eventName, parameters);
  } else {
    console.log('📊 GA not loaded, would track:', eventName, parameters);
  }
};

export default function ThankYou() {
  useEffect(() => {
    // Track successful submission completion
    trackEvent('thank_you_page_viewed', {
      event_category: 'conversion',
      event_label: 'drawing_submission_complete'
    });
  }, []);

  const handleReturnHome = () => {
    trackEvent('return_to_home_click', {
      event_category: 'navigation',
      event_label: 'thank_you_to_main_site'
    });
    
    // Return to your main domain
    window.location.href = 'https://ykabusalah.me';
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">🎉 Thank You!</h1>
      <p className="text-lg max-w-md mb-8">
        Your drawing was submitted successfully. If it's selected, it will appear on the main site
        with your name at the bottom right. Thanks for contributing!
      </p>
      
      <button
        onClick={handleReturnHome}
        className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors duration-200 shadow-sm"
      >
        Return to Home
      </button>
    </div>
  );
}