import { useEffect } from 'react';
import { trackPageView } from './analytics';

export default function ThankYou() {
  useEffect(() => {
    trackPageView('thank_you');
  }, []);

  const handleReturnHome = () => {
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