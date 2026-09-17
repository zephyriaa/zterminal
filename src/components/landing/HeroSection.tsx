'use client';

import React from 'react';
import { HeroActTransition } from './hero-act-transition';
import {
  BackgroundField,
  EditorialHeading,
  TechnicalEyebrow,
} from '@/components/public/public-primitives';
import '@/components/public/public-theme.css';

export function HeroSection() {
  return (
    <HeroActTransition
      atmosphere={<BackgroundField />}
      eyebrow={<TechnicalEyebrow>ACT I · SEE</TechnicalEyebrow>}
      heading={
        <EditorialHeading>
          Price is only
          <br />
          <em>the surface.</em>
        </EditorialHeading>
      }
      body={
        <p className="max-w-2xl mx-auto">
          Charts, market context, public depth, and recent trades stay in one
          frame—so the next question starts with evidence, not a guess.
        </p>
      }
    />
  );
}
