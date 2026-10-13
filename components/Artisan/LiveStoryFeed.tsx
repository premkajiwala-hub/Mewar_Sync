
import React from 'react';
import { Play, Heart, MessageCircle, Share2, Landmark } from 'lucide-react';
import { JharokaFrame } from '../UI/JharokaFrame';

/**
 * Selection-Winning Feature: Artisan "Live Story" Feed
 * Connects buyers to the process of creation.
 */
export const LiveStoryFeed: React.FC = () => {
  const stories = [
    { 
      id: 1, 
      artisan: 'Master Arjun', 
      task: 'Applying gold leaf to Shrinathji Pichwai', 
      image: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=400',
      likes: 124,
      location: 'Hathi Pol Workshop'
    },
    { 
      id: 2, 
      artisan: 'Rajiv Masterji', 
      task: 'Single-hair brushwork on hunting scene', 
      image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=400',
      likes: 89,
      location: 'City Palace Artisan Gallery'
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-3">
         <div className="w-12 h-12 rounded-full bg-royal-gradient flex items-center justify-center text-white">
            <Landmark size={24} />
         </div>
         <div>
            <h2 className="text-2xl font-heritage font-bold text-gray-900">Live Heritage Feed</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Real-time Craftsmanship from Udaipur</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {stories.map(story => (
          <div key={story.id} className="glass-mewar rounded-[40px] overflow-hidden group shadow-xl border border-gold/10">
            <div className="relative aspect-video">
               <img src={story.image} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-1000" />
               <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-500">
                    <Play fill="currentColor" size={32} />
                  </div>
               </div>
               <div className="absolute top-6 left-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                     <div className="w-full h-full bg-royal-gradient flex items-center justify-center text-white font-bold text-xs">
                        {story.artisan[0]}
                     </div>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm drop-shadow-md">{story.artisan}</p>
                    <p className="text-white/70 text-[10px] font-bold drop-shadow-md">{story.location}</p>
                  </div>
               </div>
            </div>
            <div className="p-8 space-y-4">
               <p className="text-gray-800 font-medium italic leading-relaxed">
                 "{story.task}"
               </p>
               <div className="flex justify-between items-center pt-4 border-t border-gold/5">
                  <div className="flex gap-4">
                    <button className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors">
                       <Heart size={18} />
                       <span className="text-xs font-bold">{story.likes}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                       <MessageCircle size={18} />
                       <span className="text-xs font-bold">Comment</span>
                    </button>
                  </div>
                  <button className="text-gold hover:text-saffron transition-colors">
                    <Share2 size={18} />
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
