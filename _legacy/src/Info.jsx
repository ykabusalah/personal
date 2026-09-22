import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { trackPageView } from './analytics';
import { createClient } from '@supabase/supabase-js';
import { Pencil, Sparkles } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function Info() {
  const navigate = useNavigate();
  const [featuredCount, setFeaturedCount] = useState(null);

  useEffect(() => {
    trackPageView('info');
    
    const fetchCount = async () => {
      const { count } = await supabase
        .from('drawings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      setFeaturedCount(count);
    };
    fetchCount();
  }, []);

  const handleDrawClick = () => {
    navigate('/draw');
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white p-8 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-64 h-64 bg-gray-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-gray-100 rounded-full blur-3xl opacity-50" />
      
      <div className="max-w-2xl w-full relative z-10">
        <div className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Interactive Experience</span>
        </div>
        
        <h1 className="text-5xl font-bold mb-8 text-gray-900">
          Hello and Welcome 👋🏽
        </h1>
        
        <div className="text-gray-600 text-lg leading-relaxed mb-10">
          <p>
            The basic idea is that your drawing can become part of my website's design.
            Approved drawings are displayed at random whenever anyone visits the site. However, if your drawing is ugly, it ain't getting chosen. Good luck :)
          </p>
        </div>

        {featuredCount !== null && featuredCount > 0 && (
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 mb-8 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            {featuredCount} drawing{featuredCount !== 1 ? 's' : ''} featured so far
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={handleDrawClick}
            className="group bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-3"
          >
            <Pencil className="w-5 h-5 transition-transform duration-200 group-hover:rotate-[-12deg]" />
            Let's Draw!
          </button>
        </div>
      </div>
    </div>
  );
}