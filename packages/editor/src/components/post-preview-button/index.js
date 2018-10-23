/**
 * External dependencies
 */
import { escape, get } from 'lodash';

/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _x } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { DotTip } from '@wordpress/nux';
import { ifCondition, compose } from '@wordpress/compose';

export class PostPreviewButton extends Component {
	constructor() {
		super( ...arguments );

		this.openPreviewWindow = this.openPreviewWindow.bind( this );
	}

	componentDidUpdate( prevProps ) {
		const { previewLink } = this.props;

		// This relies on the window being responsible to unset itself when
		// navigation occurs or a new preview window is opened, to avoid
		// unintentional forceful redirects.
		if ( previewLink && ! prevProps.previewLink ) {
			this.setPreviewWindowLink( previewLink );

			// Once popup redirect is evaluated, even if already closed, delete
			// reference to avoid later assignment of location in post update.
			delete this.previewWindow;
		}
	}

	/**
	 * Sets the preview window's location to the given URL, if a preview window
	 * exists and is not closed.
	 *
	 * @param {string} url URL to assign as preview window location.
	 */
	setPreviewWindowLink( url ) {
		const { previewWindow } = this;

		if ( previewWindow && ! previewWindow.closed ) {
			previewWindow.location = url;
		}
	}

	getWindowTarget() {
		const { postId } = this.props;
		return `wp-preview-${ postId }`;
	}

	// TODO: I rejigged this so that it always prevents default. Need to update the
	// comments to reflect that.

	/**
	 * Intercepts the Preview button's 'click' event to first perform an autosave
	 * if necessary.
	 *
	 * @param {Event} event The 'click' event to intercept.
	 */
	openPreviewWindow( event ) {
		// Prevent the regular preview link from opening. Instead, we're going to open
		// up a 'Please wait' window which we'll show until the autosave completes.
		event.preventDefault();

		// Open up a new window. This will be our 'Please wait' window. It's necessary
		// to open this *now* because popups can only be opened in response to user
		// interactions.
		if ( ! this.previewWindow || this.previewWindow.closed ) {
			this.previewWindow = window.open( 'about:blank', this.getWindowTarget() );
		}

		// Do nothing if an autosave is not needed.
		if ( ! this.props.isAutosaveable ) {
			this.setPreviewWindowLink( event.target.href );
			return;
		}

		// Request an autosave. This will happen asynchronously.
		this.props.autosave();

		// Ask the browser to bring the 'Please wait' window to the front. This can
		// work or not depending on the browser's user preferences.
		// https://html.spec.whatwg.org/multipage/interaction.html#dom-window-focus
		this.previewWindow.focus();

		// Now we just generate some HTML which politely asks the user to wait...
		const markup = `
			<div class="editor-post-preview-button__interstitial-message">
				<p>${ escape( __( 'Please wait…' ) ) }</p>
				<p>${ escape( __( 'Generating preview.' ) ) }</p>
			</div>
			<style>
				body {
					margin: 0;
				}
				.editor-post-preview-button__interstitial-message {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					height: 100vh;
					width: 100vw;
				}
				p {
					text-align: center;
					font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
				}
			</style>
		`;

		// ...and then slap it into our 'Please wait' window!
		this.previewWindow.document.write( markup );
		this.previewWindow.document.close();
	}

	render() {
		const { previewLink, currentPostLink, isSaveable } = this.props;

		// Link to the `?preview=true` URL if we have it, since this lets us see
		// changes that were autosaved since the post was last published. Otherwise,
		// just link to the post's URL.
		const href = previewLink || currentPostLink;

		return (
			<Button
				isLarge
				className="editor-post-preview"
				href={ href }
				target={ this.getWindowTarget() }
				disabled={ ! isSaveable }
				onClick={ this.openPreviewWindow }
			>
				{ _x( 'Preview', 'imperative verb' ) }
				<span className="screen-reader-text">
					{
						/* translators: accessibility text */
						__( '(opens in a new tab)' )
					}
				</span>
				<DotTip id="core/editor.preview">
					{ __( 'Click “Preview” to load a preview of this page, so you can make sure you’re happy with your blocks.' ) }
				</DotTip>
			</Button>
		);
	}
}

export default compose( [
	withSelect( ( select ) => {
		const {
			getCurrentPostId,
			getCurrentPostAttribute,
			getAutosaveAttribute,
			getEditedPostAttribute,
			isEditedPostSaveable,
			isEditedPostAutosaveable,
		} = select( 'core/editor' );
		const {
			getPostType,
		} = select( 'core' );
		const postType = getPostType( getEditedPostAttribute( 'type' ) );
		return {
			postId: getCurrentPostId(),
			currentPostLink: getCurrentPostAttribute( 'link' ),
			previewLink: getAutosaveAttribute( 'preview_link' ),
			isSaveable: isEditedPostSaveable(),
			isAutosaveable: isEditedPostAutosaveable(),
			isViewable: get( postType, [ 'viewable' ], false ),
		};
	} ),
	withDispatch( ( dispatch ) => ( {
		autosave: dispatch( 'core/editor' ).autosave,
	} ) ),
	ifCondition( ( { isViewable } ) => isViewable ),
] )( PostPreviewButton );
