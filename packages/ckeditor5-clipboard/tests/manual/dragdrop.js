/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals console, window, document */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';
import ArticlePluginSet from '@ckeditor/ckeditor5-core/tests/_utils/articlepluginset';
import AutoImage from '@ckeditor/ckeditor5-image/src/autoimage';
import AutoLink from '@ckeditor/ckeditor5-link/src/autolink';
import Code from '@ckeditor/ckeditor5-basic-styles/src/code';
import CodeBlock from '@ckeditor/ckeditor5-code-block/src/codeblock';
import EasyImage from '@ckeditor/ckeditor5-easy-image/src/easyimage';
import HorizontalLine from '@ckeditor/ckeditor5-horizontal-line/src/horizontalline';
import ImageResize from '@ckeditor/ckeditor5-image/src/imageresize';
import LinkImage from '@ckeditor/ckeditor5-link/src/linkimage';
import PageBreak from '@ckeditor/ckeditor5-page-break/src/pagebreak';
import PasteFromOffice from '@ckeditor/ckeditor5-paste-from-office/src/pastefromoffice';
import RemoveFormat from '@ckeditor/ckeditor5-remove-format/src/removeformat';
import TextTransformation from '@ckeditor/ckeditor5-typing/src/texttransformation';
import CloudServices from '@ckeditor/ckeditor5-cloud-services/src/cloudservices';
import ImageUpload from '@ckeditor/ckeditor5-image/src/imageupload';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import { UpcastWriter } from '@ckeditor/ckeditor5-engine';
import { toWidget, viewToModelPositionOutsideModelElement } from '@ckeditor/ckeditor5-widget';
import { CS_CONFIG } from '@ckeditor/ckeditor5-cloud-services/tests/_utils/cloud-services-config';

const contacts = [
	{ name: 'Huckleberry Finn',			tel: '+48 1345 234 235', email: 'h.finn@example.com', avatar: 'hfin' },
	{ name: 'D\'Artagnan',				tel: '+45 2345 234 235', email: 'dartagnan@example.com', avatar: 'dartagnan' },
	{ name: 'Phileas Fogg',				tel: '+44 3345 234 235', email: 'p.fogg@example.com', avatar: 'pfog' },
	{ name: 'Alice',					tel: '+20 4345 234 235', email: 'alice@example.com', avatar: 'alice' },
	{ name: 'Little Red Riding Hood',	tel: '+45 2345 234 235', email: 'lrrh@example.com', avatar: 'lrrh' },
	{ name: 'Winnetou',					tel: '+44 3345 234 235', email: 'winnetou@example.com', avatar: 'winetou' },
	{ name: 'Edmond Dantès',			tel: '+20 4345 234 235', email: 'count@example.com', avatar: 'edantes' },
	{ name: 'Robinson Crusoe',			tel: '+45 2345 234 235', email: 'r.crusoe@example.com', avatar: 'rcrusoe' }
];

class HCardEditing extends Plugin {
	static get requires() {
		return [ Widget ];
	}

	init() {
		this._defineSchema();
		this._defineConverters();
		this._defineClipboardInputOutput();

		this.editor.editing.mapper.on(
			'viewToModelPosition',
			viewToModelPositionOutsideModelElement( this.editor.model, viewElement => viewElement.hasClass( 'h-card' ) )
		);
	}

	_defineSchema() {
		const schema = this.editor.model.schema;

		schema.register( 'h-card', {
			allowWhere: '$text',
			isInline: true,
			isObject: true,
			allowAttributesOf: '$text',
			allowAttributes: [ 'email', 'name', 'tel' ]
		} );
	}

	_defineConverters() {
		const conversion = this.editor.conversion;

		conversion.for( 'upcast' ).elementToElement( {
			view: {
				name: 'span',
				classes: [ 'h-card' ]
			},
			model: ( viewElement, { writer, consumable } ) => {
				return writer.createElement( 'h-card', getAndConsumeHCardViewElement( viewElement, consumable ) );
			}
		} );

		conversion.for( 'editingDowncast' ).elementToElement( {
			model: 'h-card',
			view: ( modelItem, { writer: viewWriter } ) => toWidget( createView( modelItem, viewWriter ), viewWriter )
		} );

		conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'h-card',
			view: ( modelItem, { writer: viewWriter } ) => createView( modelItem, viewWriter )
		} );

		// Helper method for both downcast converters.
		function createView( modelItem, viewWriter ) {
			const email = modelItem.getAttribute( 'email' );
			const name = modelItem.getAttribute( 'name' );
			const tel = modelItem.getAttribute( 'tel' );

			const cardView = viewWriter.createContainerElement( 'span', {
				class: 'h-card'
			}, {
				isAllowedInsideAttributeElement: true
			} );

			const linkView = viewWriter.createContainerElement( 'a', { href: `mailto:${ email }`, class: 'p-name u-email' } );
			const phoneView = viewWriter.createContainerElement( 'span', { class: 'p-tel' } );

			viewWriter.insert( viewWriter.createPositionAt( linkView, 0 ), viewWriter.createText( name ) );
			viewWriter.insert( viewWriter.createPositionAt( phoneView, 0 ), viewWriter.createText( tel ) );

			viewWriter.insert( viewWriter.createPositionAt( cardView, 0 ), linkView );
			viewWriter.insert( viewWriter.createPositionAt( cardView, 'end' ), phoneView );

			return cardView;
		}
	}

	_defineClipboardInputOutput() {
		const document = this.editor.editing.view.document;

		this.listenTo( document, 'clipboardInput', ( evt, data ) => {
			const contactData = data.dataTransfer.getData( 'contact' );

			if ( !contactData ) {
				return;
			}

			const contact = JSON.parse( contactData );
			const writer = new UpcastWriter( document );
			const fragment = writer.createDocumentFragment();

			writer.appendChild(
				writer.createElement( 'span', { class: 'h-card' }, [
					writer.createElement( 'a', { href: `mailto:${ contact.email }`, class: 'p-name u-email' }, contact.name ),
					writer.createElement( 'span', { class: 'p-tel' }, contact.tel )
				] ),
				fragment
			);

			data.content = fragment;
		} );

		this.listenTo( document, 'clipboardOutput', ( evt, data ) => {
			if ( data.content.childCount != 1 ) {
				return;
			}

			const viewElement = data.content.getChild( 0 );

			if ( viewElement.is( 'element', 'span' ) && viewElement.hasClass( 'h-card' ) ) {
				data.dataTransfer.setData( 'contact', JSON.stringify( getAndConsumeHCardViewElement( viewElement ) ) );
			}
		} );
	}
}

function getAndConsumeHCardViewElement( viewElement, consumable ) {
	const children = Array.from( viewElement.getChildren() );
	const linkElement = children.find( element => element.is( 'element', 'a' ) && element.hasClass( 'p-name' ) );
	const telElement = children.find( element => element.is( 'element', 'span' ) && element.hasClass( 'p-tel' ) );

	if ( consumable ) {
		consumable.consume( linkElement, { name: true, attributes: [ 'href' ], classes: [ 'p-name', 'u-email' ] } );
		consumable.consume( telElement, { name: true, classes: 'p-tel' } );
	}

	return {
		name: getAndConsumeText( linkElement, consumable ),
		tel: getAndConsumeText( telElement, consumable ),
		email: linkElement.getAttribute( 'href' ).replace( /^mailto:/i, '' )
	};
}

function getAndConsumeText( viewElement, consumable ) {
	return Array.from( viewElement.getChildren() )
		.map( node => {
			if ( !node.is( '$text' ) ) {
				return '';
			}

			if ( consumable ) {
				consumable.consume( node );
			}

			return node.data;
		} )
		.join( '' );
}

ClassicEditor
	.create( document.querySelector( '#editor' ), {
		plugins: [
			ArticlePluginSet, Code, RemoveFormat, CodeBlock, EasyImage, ImageResize, LinkImage,
			AutoImage, AutoLink, TextTransformation, Alignment, PasteFromOffice, PageBreak,
			HorizontalLine, ImageUpload, CloudServices, HCardEditing
		],
		toolbar: [
			'heading',
			'|',
			'removeFormat', 'bold', 'italic', 'code', 'link',
			'|',
			'bulletedList', 'numberedList',
			'|',
			'blockQuote', 'uploadImage', 'insertTable', 'mediaEmbed', 'codeBlock',
			'|',
			'alignment',
			'|',
			'pageBreak', 'horizontalLine',
			'|',
			'undo', 'redo'
		],
		cloudServices: CS_CONFIG,
		table: {
			contentToolbar: [ 'tableColumn', 'tableRow', 'mergeTableCells' ]
		},
		image: {
			styles: [
				'alignCenter',
				'alignLeft',
				'alignRight'
			],
			toolbar: [
				'imageTextAlternative', '|',
				'imageStyle:alignLeft', 'imageStyle:alignCenter', 'imageStyle:alignRight', '|',
				'resizeImage'
			]
		},
		placeholder: 'Type the content here!'
	} )
	.then( editor => {
		window.editor = editor;

		const button = document.getElementById( 'read-only' );

		button.addEventListener( 'click', () => {
			editor.isReadOnly = !editor.isReadOnly;
			button.textContent = editor.isReadOnly ? 'Turn off read-only mode' : 'Turn on read-only mode';

			editor.editing.view.focus();
		} );
	} )
	.catch( err => {
		console.error( err.stack );
	} );

const contactsContainer = document.querySelector( '#contactList' );

contactsContainer.addEventListener( 'dragstart', event => {
	const draggable = event.target.closest( '[draggable]' );

	event.dataTransfer.setData( 'text/plain', draggable.innerText );
	event.dataTransfer.setData( 'text/html', draggable.innerText );
	event.dataTransfer.setData( 'contact', JSON.stringify( contacts[ draggable.dataset.contact ] ) );

	event.dataTransfer.setDragImage( draggable, 0, 0 );
} );

contacts.forEach( ( contact, id ) => {
	const li = document.createElement( 'li' );

	li.innerHTML =
		`<div class="contact h-card" data-contact="${ id }" draggable="true">` +
			`<img src="assets/${ contact.avatar }.png" alt="avatar" class="u-photo" draggable="false" />` +
			contact.name +
		'</div>';

	contactsContainer.appendChild( li );
} );

const dropArea = document.querySelector( '#drop-area' );

dropArea.addEventListener( 'dragover', event => {
	event.preventDefault();
	event.dataTransfer.dropEffect = 'copy';
	dropArea.classList.add( 'dragover' );
} );

dropArea.addEventListener( 'dragleave', () => {
	dropArea.classList.remove( 'dragover' );
} );

dropArea.addEventListener( 'drop', event => {
	const contact = event.dataTransfer.getData( 'contact' );

	dropArea.innerText =
		'-- text/plain --\n' + event.dataTransfer.getData( 'text/plain' ) + '\n\n' +
		'-- text/html --\n' + event.dataTransfer.getData( 'text/html' ) + '\n\n' +
		'-- contact --\n' + ( contact ? JSON.stringify( JSON.parse( contact ), 0, 2 ) : '' ) + '\n';
	dropArea.classList.remove( 'dragover' );
} );