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

const BLOCK_SWITCHER_SELECTOR = '.editor-block-toolbar .editor-block-switcher';

const getAvailableBlockTransforms = async () => {
	return await page.evaluate( () => {
		return Array.from(
			document.querySelectorAll(
				'.editor-block-types-list .editor-block-types-list__list-item button'
			)
		).map(
			( button ) => {
				return button.getAttribute( 'aria-label' );
			}
		);
	} );
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
		`.editor-block-types-list .editor-block-types-list__list-item button[aria-label="${ transformName }"]`
	);
	return getEditedPostContent();
};

describe( 'test transforms', () => {
	const expectedTransforms = JSON.parse(
		readFixtureFile(
			path.join( __dirname, 'fixtures' ),
			'block-transforms.json'
		)
	);

	const fixturesDir = path.join(
		__dirname, '..', '..', 'integration', 'full-content', 'fixtures'
	);

	const fileBasenames = getFileBaseNames( fixturesDir );

	const transformStructure = {};
	beforeAll( async () => {
		await newPost();
		await page.click( '.editor-post-title .editor-post-title__block' );
		for ( const fileBase of fileBasenames ) {
			transformStructure[ fileBase ] = await getTransformStructureFromFile(
				fixturesDir,
				fileBase
			);
		}
		expect( console ).toHaveErroredWith(
			'Failed to load resource: the server responded with a status of 404 (Not Found)'
		);
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
		).toEqual( expectedTransforms );
	} );

	describe( 'individual transforms work as expected', () => {
		afterEach( async () => {
			await setPostContent( '' );
			await page.click( '.editor-post-title .editor-post-title__block' );
		} );

		for ( const [ fixture, transforms ] of Object.entries( expectedTransforms ) ) {
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
