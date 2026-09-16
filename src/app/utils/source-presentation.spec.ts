import {
  sourceClass,
  sourceIcon,
  sourceKeyLabel,
  sourceModifier,
  sourceTypeLabel,
  splitSourceKey
} from './source-presentation';

describe('source-presentation', () => {

  it('stylesAlfrescoAndNuxeoAndNothingElse', () => {
    expect(sourceModifier('alfresco')).toBe('alfresco');
    expect(sourceModifier('nuxeo')).toBe('nuxeo');

    // A third source must not borrow either repository's colour, which is what the two-way ternaries
    // it replaces did.
    expect(sourceModifier('cmis')).toBe('generic');
    expect(sourceModifier('sample-directory')).toBe('generic');
    expect(sourceModifier(undefined)).toBe('generic');
  });

  it('composesAClassNamePerPrefix', () => {
    expect(sourceClass('source-badge', 'alfresco')).toBe('source-badge-alfresco');
    expect(sourceClass('result', 'cmis')).toBe('result-generic');
  });

  it('picksAnIconWithANeutralDefault', () => {
    expect(sourceIcon('alfresco')).toBe('storage');
    expect(sourceIcon('nuxeo')).toBe('folder_open');
    expect(sourceIcon('cmis')).toBe('description');
  });

  it('labelsAKnownTypeByNameAndDeslugsAnUnknownOne', () => {
    expect(sourceTypeLabel('cmis')).toBe('CMIS');
    expect(sourceTypeLabel('sharepoint')).toBe('SharePoint');

    // 'Sample-directory' is what a titlecase pipe produces, and is the label issue #9 objects to.
    expect(sourceTypeLabel('sample-directory')).toBe('Sample Directory');
    expect(sourceTypeLabel('acme_vault')).toBe('Acme Vault');
    expect(sourceTypeLabel(undefined)).toBe('Unknown source');
  });

  it('isCaseAndWhitespaceInsensitiveAboutTheType', () => {
    expect(sourceModifier(' Alfresco ')).toBe('alfresco');
    expect(sourceTypeLabel('CMIS')).toBe('CMIS');
  });

  it('splitsASourceKeyOnTheFirstColonOnly', () => {
    expect(splitSourceKey('alfresco:abc-uuid')).toEqual({ sourceType: 'alfresco', sourceId: 'abc-uuid' });

    // A source id may itself contain a colon; only the first separates type from id.
    expect(splitSourceKey('cmis:http://host:8080/repo'))
      .toEqual({ sourceType: 'cmis', sourceId: 'http://host:8080/repo' });

    expect(splitSourceKey('filesystem')).toEqual({ sourceType: 'filesystem', sourceId: '' });
  });

  it('namesASourceByItsIdSoTwoOfATypeAreDistinguishable', () => {
    expect(sourceKeyLabel('cmis:docmgr')).toBe('CMIS (docmgr)');
    expect(sourceKeyLabel('cmis:archive')).toBe('CMIS (archive)');
    expect(sourceKeyLabel('nuxeo')).toBe('Nuxeo');
    expect(sourceKeyLabel(undefined)).toBe('Unknown source');
  });
});
