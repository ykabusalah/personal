import { useNavigate } from 'react-router-dom';

export default function Info() {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white p-8">
      <div className="max-w-2xl w-full">
        {/* Main heading with emoji */}
        <h1 className="text-4xl font-bold mb-8 text-gray-900">
          Hello and Welcome 👋🏽
        </h1>
        
        {/* Body text with better spacing */}
        <div className="space-y-6 text-gray-700 text-lg leading-relaxed mb-12">
          <p>
            The basic idea is that your drawing can become part of my website design.
            The drawings will be displayed at random whenever you visit the site.
          </p>
          <p>
            However, if your photo is ugly, it ain't staying up. Good luck :).
          </p>
        </div>

        {/* Call to action button */}
        <button
          onClick={() => navigate('/draw')}
          className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors duration-200 shadow-sm"
        >
          Let's Draw!
        </button>
      </div>
    </div>
  );
}