import { learnContent } from '../learnContent';

describe('Learn signed-content adapter', () => {
  test.each(['he', 'ar', 'en'] as const)(
    'publishes localized glossary, rights, and contacts for %s',
    (language) => {
      const content = learnContent(language);
      expect(content.glossary).toHaveLength(89);
      expect(content.rights).toHaveLength(25);
      expect(content.contacts).toHaveLength(18);
      expect(content.glossary.every((row) => row.title !== '' && row.body !== '')).toBe(true);
      expect(content.rights.every((row) => row.title !== '' && row.body !== '')).toBe(true);
      expect(content.contacts.every((row) => row.name !== '')).toBe(true);
    },
  );
});

