/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { globalSoundFX } from '../audio/soundFX';

export const AudioMuteButton: React.FC = () => {
  const [isMuted, setIsMuted] = useState(() => globalSoundFX.getIsMuted());

  const handleToggle = () => {
    const next = globalSoundFX.toggleMute();
    setIsMuted(next);
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-all cursor-pointer ${
        isMuted
          ? 'bg-[#101726] border-[#232d3f] text-[#64748b] hover:text-[#94a3b8]'
          : 'bg-indigo-950/40 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50'
      }`}
      title={isMuted ? 'Unmute Audio Chimes & Risk Alerts' : 'Mute Sound FX'}
    >
      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      <span className="hidden xl:inline text-[11px] font-bold">{isMuted ? 'Muted' : 'Audio On'}</span>
    </button>
  );
};
