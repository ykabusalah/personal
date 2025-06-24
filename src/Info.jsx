
import { useNavigate } from 'react-router-dom';

export default function Info() {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-2xl font-bold mb-6">Before You Start Drawing</h1>
      <p className="mb-4 max-w-xl">
        The basic idea is that your drawing can become part of my website design.
        The drawings will be displayed at random whenever you visit the site.
        However, if your photo is ugly, it ain’t staying up. Good luck :).
      </p>
      <button
        onClick={() => navigate('/draw')}
        className="bg-black text-white px-6 py-3 rounded text-lg"
      >
        Let's Draw!
      </button>
    </div>
  );
}
