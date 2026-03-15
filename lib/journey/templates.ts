import { JourneyDefinition, JourneyScenario, JourneyTemplateId } from '@/lib/journey/types';

export const JOURNEY_DEFINITIONS: Record<JourneyTemplateId, JourneyDefinition> = {
  checkout: {
    id: 'checkout',
    name: 'Checkout Journey',
    version: '1.0.0',
    entryUrl: 'https://example.com/cart',
    fallbackWaitMs: 200,
    steps: [
      {
        id: 'checkout-step-1',
        name: 'Focus cart summary',
        goal: 'Reach order summary with keyboard only',
        selectorRef: '#cart-summary',
        action: 'Tab',
        assertions: [{ type: 'focus-on', value: '#cart-summary', message: 'Cart summary should be focusable.' }],
      },
      {
        id: 'checkout-step-2',
        name: 'Select payment method',
        goal: 'Reach payment method radio group',
        selectorRef: '#payment-method',
        action: 'Tab',
        criticalPath: true,
        assertions: [{ type: 'focus-on', value: '#payment-method', message: 'Payment method radio group should be reachable.' }],
      },
      {
        id: 'checkout-step-3',
        name: 'Place order',
        goal: 'Submit order by keyboard',
        selectorRef: '#place-order',
        action: 'Enter',
        criticalPath: true,
        assertions: [{ type: 'url-contains', value: '/checkout/confirmation', message: 'Order should navigate to confirmation page.' }],
      },
    ],
  },
  signup: {
    id: 'signup',
    name: 'Signup Journey',
    version: '1.0.0',
    entryUrl: 'https://example.com/signup',
    fallbackWaitMs: 200,
    steps: [
      {
        id: 'signup-step-1',
        name: 'Reach email field',
        goal: 'Keyboard user can focus email field',
        selectorRef: '#signup-email',
        action: 'Tab',
        assertions: [{ type: 'focus-on', value: '#signup-email', message: 'Email field should be in tab order.' }],
      },
      {
        id: 'signup-step-2',
        name: 'Reach password field',
        goal: 'Password field focus should be visible',
        selectorRef: '#signup-password',
        action: 'Tab',
        assertions: [{ type: 'focus-visible', value: '#signup-password', message: 'Password field should display visible focus.' }],
      },
      {
        id: 'signup-step-3',
        name: 'Submit signup',
        goal: 'Enter submits signup form',
        selectorRef: '#signup-submit',
        action: 'Enter',
        criticalPath: true,
        assertions: [{ type: 'url-contains', value: '/welcome', message: 'Signup should navigate to welcome page.' }],
      },
    ],
  },
  'book-appointment': {
    id: 'book-appointment',
    name: 'Book Appointment Journey',
    version: '1.0.0',
    entryUrl: 'https://example.com/appointments',
    fallbackWaitMs: 200,
    steps: [
      {
        id: 'booking-step-1',
        name: 'Choose service',
        goal: 'Move focus to service picker',
        selectorRef: '#service-picker',
        action: 'Tab',
        assertions: [{ type: 'focus-on', value: '#service-picker', message: 'Service picker should be reachable.' }],
      },
      {
        id: 'booking-step-2',
        name: 'Choose time slot',
        goal: 'Arrow keys can pick a timeslot',
        selectorRef: '#time-slot',
        action: 'ArrowDown',
        criticalPath: true,
        assertions: [{ type: 'focus-on', value: '#time-slot', message: 'Timeslot option should retain focus.' }],
      },
      {
        id: 'booking-step-3',
        name: 'Confirm appointment',
        goal: 'Submit and reach confirmation',
        selectorRef: '#book-submit',
        action: 'Enter',
        criticalPath: true,
        assertions: [{ type: 'url-contains', value: '/appointments/confirmed', message: 'Booking should navigate to confirmation.' }],
      },
    ],
  },
};

export function buildScenario(templateId: JourneyTemplateId, targetUrl?: string): JourneyScenario {
  const url = targetUrl || JOURNEY_DEFINITIONS[templateId].entryUrl;
  const failureMode = url.toLowerCase();

  const base: Record<JourneyTemplateId, JourneyScenario> = {
    checkout: {
      templateId,
      url,
      controlsInTabOrder: [
        { id: 'cart-summary', selector: '#cart-summary', reachable: true, focusVisible: true },
        {
          id: 'payment-method',
          selector: '#payment-method',
          reachable: !failureMode.includes('unreachable-payment'),
          focusVisible: true,
        },
        {
          id: 'place-order',
          selector: '#place-order',
          reachable: true,
          focusVisible: true,
          nextUrl: failureMode.includes('unexpected-nav') ? '/support' : '/checkout/confirmation',
        },
      ],
    },
    signup: {
      templateId,
      url,
      controlsInTabOrder: [
        { id: 'signup-email', selector: '#signup-email', reachable: true, focusVisible: true },
        {
          id: 'signup-password',
          selector: '#signup-password',
          reachable: true,
          focusVisible: !failureMode.includes('missing-focus'),
        },
        { id: 'signup-submit', selector: '#signup-submit', reachable: true, focusVisible: true, nextUrl: '/welcome' },
      ],
    },
    'book-appointment': {
      templateId,
      url,
      controlsInTabOrder: [
        { id: 'service-picker', selector: '#service-picker', reachable: true, focusVisible: true },
        {
          id: 'time-slot',
          selector: '#time-slot',
          reachable: true,
          focusVisible: true,
          nextUrl: failureMode.includes('context-loss') ? '/appointments?step=1' : undefined,
        },
        {
          id: 'book-submit',
          selector: '#book-submit',
          reachable: true,
          focusVisible: true,
          nextUrl: '/appointments/confirmed',
        },
      ],
    },
  };

  return base[templateId];
}
