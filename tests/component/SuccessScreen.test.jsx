import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SuccessScreen from '../../src/components/SuccessScreen';

describe('SuccessScreen', () => {
  it('displays team number', () => {
    render(<SuccessScreen teamNumber={7} projectName="Alpha" />);
    expect(screen.getByText('Team 7')).toBeInTheDocument();
  });

  it('displays project name', () => {
    render(<SuccessScreen teamNumber={1} projectName="Beta Project" />);
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('shows "Registration Successful!" heading', () => {
    render(<SuccessScreen teamNumber={1} projectName="Alpha" />);
    expect(screen.getByText('Registration Successful!')).toBeInTheDocument();
  });

  it('has no back button or re-register option', () => {
    render(<SuccessScreen teamNumber={1} projectName="Alpha" />);
    const buttons = screen.queryAllByRole('button');
    const links = screen.queryAllByRole('link');
    // There should be no interactive elements to go back or register again
    const reRegTexts = screen.queryByText(/register another|go back|try again/i);
    expect(reRegTexts).toBeNull();
    expect(buttons).toHaveLength(0);
    expect(links).toHaveLength(0);
  });
});
