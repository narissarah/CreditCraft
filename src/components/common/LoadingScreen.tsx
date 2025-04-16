import React from 'react';
import { Spinner, Frame, TextContainer } from '@shopify/polaris';

interface LoadingScreenProps {
  message?: string;
}

/**
 * Loading screen component
 * Displays a centered spinner with an optional message
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100%',
    }}>
      <Frame>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem',
        }}>
          <Spinner size="large" />
          <div style={{ marginTop: '1rem' }}>
            <TextContainer>
              <p>{message}</p>
            </TextContainer>
          </div>
        </div>
      </Frame>
    </div>
  );
}

export default LoadingScreen; 