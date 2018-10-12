/**
 * External dependencies
 */
import path from 'path';
import { mapValues, pickBy, some } from 'lodash';

/**
 * Internal dependencies
 */
import {
	newPost,
	setPostContent,
	getAllBlocks,
	getEditedPostContent,
	selectBlockByClientId,
} from '../support/utils';
import {
	getFileBaseNames,
	readFixtureFile,
} from '../../support/utils';
import { EXPECTED_TRANSFORMS } from './fixtures/block-transforms';

const BLOCK_SWITCHER_SELECTOR = '.editor-block-toolbar .editor-block-switcher';
const TRANSFORM_BUTTON_SELECTOR = '.editor-block-types-list .editor-block-types-list__list-item button';

const getAvailableBlockTransforms = async () => {
	return await page.evaluate( ( buttonSelector ) => {
		return Array.from(
			document.querySelectorAll(
				buttonSelector
			)
		).map(
			( button ) => {
				return button.getAttribute( 'aria-label' );
			}
		);
	}, TRANSFORM_BUTTON_SELECTOR );
};

const hasBlockSwitcher = async () => {
	return await page.evaluate( ( blockSwitcherSelector ) => {
		return !! document.querySelector( blockSwitcherSelector );
	}, BLOCK_SWITCHER_SELECTOR );
};

const isAnExpectedUnhandledBlock = ( fixturesDir, fileBase ) => {
	if ( fileBase.includes( 'deprecated' ) ) {
		return true;
	}
	const parsedBlockObject = JSON.parse(
		readFixtureFile( fixturesDir, fileBase + '.parsed.json' )
	)[ 0 ];
	return some(
		[
			null,
			'core/block',
			'core/freeform',
			'core/text-columns',
			'core/text',
			'core/column',
			'core/subhead',
		],
		( blockName ) => parsedBlockObject.blockName === blockName
	);
};

const setPostContentAndSelectBlock = async ( content ) => {
	await setPostContent( content );
	const blocks = await getAllBlocks();
	const clientId = blocks[ 0 ].clientId;
	await page.click( '.editor-post-title .editor-post-title__block' );

	await selectBlockByClientId( clientId );
};

const getTransformStructureFromFile = async ( fixturesDir, fileBase ) => {
	if ( isAnExpectedUnhandledBlock( fixturesDir, fileBase ) ) {
		return {
			expectedUnhandledBlock: true,
		};
	}
	const content = readFixtureFile( fixturesDir, fileBase + '.html' );
	await setPostContentAndSelectBlock( content );
	let availableTransforms = [];
	if ( await hasBlockSwitcher() ) {
		await page.click( BLOCK_SWITCHER_SELECTOR );
		availableTransforms = await getAvailableBlockTransforms();
	}

	return {
		content,
		availableTransforms,
	};
};

const getTransformResult = async ( blockContent, transformName ) => {
	await setPostContentAndSelectBlock( blockContent );
	expect( await hasBlockSwitcher() ).toBe( true );
	await page.click( BLOCK_SWITCHER_SELECTOR );
	await page.click(
		`${ TRANSFORM_BUTTON_SELECTOR }[aria-label="${ transformName }"]`
	);
	return getEditedPostContent();
};

describe( 'test transforms', () => {
	const fixturesDir = path.join(
		__dirname, '..', '..', 'integration', 'full-content', 'fixtures'
	);

	const fileBasenames = getFileBaseNames( fixturesDir );

	const transformStructure = {};
	beforeAll( async () => {
		await newPost();

		for ( const fileBase of fileBasenames ) {
			transformStructure[ fileBase ] = await getTransformStructureFromFile(
				fixturesDir,
				fileBase
			);
			await setPostContent( '' );
			await page.click( '.editor-post-title .editor-post-title__block' );
		}
	} );

	it( 'Should contain the expected transforms', async () => {
		expect(
			mapValues(
				pickBy(
					transformStructure,
					( { availableTransforms } ) => availableTransforms,
				),
				'availableTransforms'
			)
		).toEqual( EXPECTED_TRANSFORMS );
	} );

	describe( 'individual transforms work as expected', () => {
		beforeAll( async () => {
			await newPost();
		} );

		afterEach( async () => {
			await setPostContent( '' );
			await page.click( '.editor-post-title .editor-post-title__block' );
		} );

		for ( const [ fixture, transforms ] of Object.entries( EXPECTED_TRANSFORMS ) ) {
			for ( const transform of transforms ) {
				it( `Should correctly transform block in fixture ${ fixture } to ${ transform } block`,
					async () => {
						const { content } = transformStructure[ fixture ];
						expect(
							await getTransformResult( content, transform )
						).toMatchSnapshot();
					}
				);
			}
		}
	} );
} );
