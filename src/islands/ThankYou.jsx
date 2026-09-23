import { useEffect } from 'react';
import { trackPageView } from '../lib/analytics';

export default function ThankYou() {
  useEffect(() => {
    trackPageView('thank_you');
  }, []);

  const handleReturnHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-5xl font-normal leading-none mb-6" style={{ fontFamily: 'var(--font-display)' }}>🎉 Thank You!</h1>
      <p className="text-lg max-w-md mb-8">
        Your drawing was submitted successfully. If it's selected, it will appear on the main site
        with your name at the bottom right. Thanks for contributing!
      </p>
      
      <button
        onClick={handleReturnHome}
        className="hover:opacity-90 px-8 py-4 rounded-lg text-lg font-medium transition-opacity duration-200 shadow-sm"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        Return to Home
      </button>
    </div>
  );
}