define([
  'core/js/adapt',
  'components/adapt-contrib-media/js/adapt-contrib-media'
], function(Adapt, Media) {

  const VideoBranchingView = Media.view.extend({

    started: false,
    ended: false,
    initialVideo: true,
    finalVideo: false,

    events: _.extend({
      'change .svb__item input': 'onItemClicked',
      'click .js-btn-action': 'submitButtonClicked',
      'click .js-btn-feedback': 'showFeedback',
      'click .js-btn-replay': 'replayButtonClicked',
      'click .js-svb-transcript-skip-btn': 'skipToQuestionButtonClicked',
      'click .js-svb-results-btn': 'onFinalVideoEnded',
      'click .js-retry-btn': 'onRetryClick'
    }, Media.view.prototype.events()),

    preRender: function() {
      this.listenTo(Adapt, {
        'device:resize': this.onScreenSizeChanged,
        'device:changed': this.onDeviceChanged,
        'media:stop': this.onMediaStop
      });

      _.bindAll(this, 'onMediaElementPlay', 'onMediaElementPause', 'onMediaElementEnded', 'onMediaElementTimeUpdate', 'onMediaElementSeeking', 'onOverlayClick', 'onMediaElementClick');

      this.checkIfResetOnRevisit?.();
    },

    postRender: function() {
      this.setReadyStatus();
      this.handleVideo(this.model.get('_initialVideo'));
      this.height = this.$('.js-svb-target').height();
    },

    /** *****MEDIA********************************************************/

    handleVideo: function(item) {
      item._media.autoplay = false;
      this.$el.removeClass('is-question is-results').addClass('is-media');
      this.ended = false;

      item._useClosedCaptions = this.model.get('_useClosedCaptions') || false;
      if (!item._transcript) item._transcript = this.model.get('_transcript');
      if (!item._globals) item._globals = this.model.get('_globals');

      this.$('.js-svb-target')
        .html(Handlebars.templates.svbMedia(item));

      this.setAriaRegionLabel(Adapt.course.get('_globals')._components._simpleVideoBranching.ariaRegionVideo, !this.initialVideo);

      this.setupPlayer();

      this.restoreVolume();

      if (this.initialVideo) {
        this.$el.removeClass('is-answered');
        this.initialVideo = false;
      } else {
        item._media.autoplay = true;
      }

      if (this.model.get('_isReplay')) {
        this.model.set('_isReplay', false);
        item._media.autoplay = true;
      }

      if (item._media.transcript) this.handleTranscript(item);

      this.playVideo(item);
    },

    handleTranscript: function(item) {
      this.$('.js-svb-transcript-body-inline').html(item._media.transcript);
    },

    skipToQuestionButtonClicked: function() {
      this.handleQuestions(this.model.get('_question'));

      $('body').scrollTo(this.$('.js-svb-target'), 500);
    },

    /* extend */
    setupPlayer: function() {
      Media.view.prototype.setupPlayer.call(this);
      // stop the video from assuming focus on play.
      this.$('.mejs-mediaelement video').attr({
        'aria-hidden': 'true',
        tabindex: '-1'
      });

      this.$('.mejs-video').removeAttr('aria-label');
    },

    /* override */
    setupEventListeners: function() {
      // handle other completion events in the event Listeners
      $(this.mediaElement).on({
        play: this.onMediaElementPlay,
        pause: this.onMediaElementPause,
        ended: this.onMediaElementEnded,
        volumechange: this.storeVolume.bind(this)
      });

      // occasionally the mejs code triggers a click of the captions language
      // selector during setup, this slight delay ensures we skip that
      _.delay(this.listenForCaptionsChange.bind(this), 250);
    },

    playVideo: function(item) {
      window.me = this.mediaElement;
      if (!item._media.autoplay) return;
      _.delay(this.onOverlayClick.bind(this), 100);// no idea why the delay is needed (it wasn't for 405286) but it works, so whatever...
    },

    storeVolume: function(e) {
      const newVolume = e.target.muted ? 0 : e.target.volume;
      this.model.set('_volume', newVolume);
    },

    restoreVolume: function() {
      const storedVolume = this.model.get('_volume');
      if (storedVolume || storedVolume === 0) {
        this.mediaElement.player.setVolume(storedVolume);
      }
    },

    onMediaElementPlay: function() {
      this.setAriaRegionLabel('');
    },

    /* override */
    onMediaElementEnded: function() {
      if (this.ended) return;
      this.ended = true;

      $(this.mediaElement).off();

      if (this.finalVideo) {
        this.onFinalVideoEnded();
        return;
      }

      this.handleQuestions(this.model.get('_question'));
      this.finalVideo = true;
    },

    onFinalVideoEnded: function() {
      this.$el.removeClass('is-media is-question').addClass('is-results');

      const height = this.$('.js-svb-target').height();
      const isCorrect = this.model.get('_isCorrect');
      const config = this.model.get('_finalSlide')[isCorrect ? '_correct' : '_incorrect'];
      config.icon = 'assets/thumb-' + (isCorrect ? 'up' : 'down') + '.svg';

      if (!isCorrect || this.model.get('_allowRetryOnPass')) {
        config._showRetry = true;
      }

      this.$('.js-svb-target')
        .html(Handlebars.templates.svbResults(config))
        .css('min-height', height);
      // height changed to min-height to prevent content being cropped when greater than the video
      // min-height applied to inner to maintain video height as a minimum
      this.$('.svb__results-inner').css('min-height', height);

      this.setCompletionStatus();
    },

    /** *****QUESTIONS****************************************************/

    handleQuestions: function(item) {
      this.$el.removeClass('is-media is-results').addClass('is-question');

      item._id = this.model.get('_id');
      item._buttons = this.model.get('_buttons');

      this.model.setupQuestion();

      this.$('.js-svb-target')
        .html(Handlebars.templates.svbQuestion(item))
        .css('min-height', this.height);
      // height changed to min-height to prevent content being cropped when greater than the video
      // min-height applied to inner to maintain video height as a minimum
      this.$('.svb__questions-inner').css('min-height', this.height);

      this.setAriaRegionLabel(Adapt.course.get('_globals')._components._simpleVideoBranching.ariaRegionQuestion, true);

      this.setBackground(item);
    },

    setAriaRegionLabel: function(text, shouldFocus = false) {
      const template = Handlebars.compile(text);
      const $ariaTarget = this.$('.js-aria-target');
      $ariaTarget.html(template(this.model.toJSON()));

      if (!shouldFocus) return;

      Adapt.a11y.focusFirst($ariaTarget, { defer: false });
    },

    setBackground: function(item) {
      if (!item.background) return;

      this.$('.svb__questions-outer').css('background-image', `url(${item.background})`);
    },

    onItemClicked: function(event) {
      const currentItem = this.model.get('_question');
      const clickedItemIndex = event.currentTarget.parentNode.dataset.index;
      const selectedItemObject = currentItem._options[clickedItemIndex];
      this.toggleItemSelected(selectedItemObject, event);

      // enable submit button if at least one answer is selected, disable it if nothing selected
      const shouldDisable = (this.model.get('_selectedItems').length === 0);
      this.$('.js-btn-action').toggleClass('is-disabled', shouldDisable).attr('disabled', shouldDisable);
    },

    toggleItemSelected: function(item, clickEvent) {
      const selectedItems = this.model.get('_selectedItems');
      const currentItem = this.model.get('_question');
      const itemIndex = currentItem._options.indexOf(item);
      const $itemLabel = this.$('.svb__questions-inner label').eq(itemIndex);
      const $itemInput = this.$('.svb__questions-inner input').eq(itemIndex);
      const selected = !$itemLabel.hasClass('is-selected');

      if (selected) {
        if (this.model.get('_selectable') === 1) {
          this.$('.svb__questions-inner label').removeClass('is-selected');
          this.$('.svb__questions-inner input').prop('checked', false);
          this.deselectAllItems();
          selectedItems[0] = item;
        } else if (selectedItems.length < this.model.get('_selectable')) {
          selectedItems.push(item);
        } else {
          if (clickEvent) clickEvent.preventDefault();
          return;
        }
        $itemLabel.addClass('is-selected');
      } else {
        selectedItems.splice(selectedItems.indexOf(item), 1);
        $itemLabel.removeClass('is-selected');
      }
      $itemInput.prop('checked', selected);
      item._isSelected = selected;
      this.model.set('_selectedItems', selectedItems);
    },

    deselectAllItems: function() {
      this.model.deselectAllItems();
    },

    disableItems: function() {
      const $items = this.$('.svb__item');
      $items.find('input').prop('disabled', true);
      $items.find('label').addClass('is-disabled');
    },

    submitButtonClicked: function() {
      const selectedItems = this.model.get('_selectedItems');
      if (selectedItems.length < 1) return;

      this.model.set('_isCorrect', selectedItems[0]._shouldBeSelected);

      this.setAriaRegionLabel('', false);

      this.$el.addClass('is-answered');

      this.disableItems();

      const feedback = selectedItems[0].feedback;
      if (!feedback) {
        this.onFeedbackClosed();
        return;
      }

      this.model.set({
        feedbackTitle: Adapt.course.get('_globals')._components._simpleVideoBranching.feedbackPopupTitle,
        feedbackMessage: Handlebars.compile(feedback)(this.model.toJSON())
      });

      this.$('.js-btn-feedback').removeClass('u-display-none');
      this.showFeedback(feedback);
    },

    replayButtonClicked: function() {
      this.initialVideo = true;
      this.finalVideo = false;
      this.model.set('_isReplay', true).resetOptions();
      // this.$('.media-inline-transcript-skip-to-question').removeClass('display-none');
      this.handleVideo(this.model.get('_initialVideo'));
    },

    onRetryClick: function() {
      this.$el.removeClass('is-answered');
      this.model.resetOptions();

      this.handleQuestions(this.model.get('_question'));
    },

    showFeedback: function() {
      Adapt.trigger('questionView:showFeedback', this);

      this.listenToOnce(Adapt, 'notify:closed', this.onFeedbackClosed);
    },

    onFeedbackClosed: function() {
      const finalVideoConfig = this.model.get('_finalVideo');

      if (!finalVideoConfig || finalVideoConfig._isEnabled === false) {
        this.setCompletionStatus();
        return;
      }

      this.showFinalVideo(finalVideoConfig);
    },

    showFinalVideo: function(finalVideoConfig) {
      const status = this.model.get('_isCorrect') ? '_correct' : '_incorrect';
      const finalVideo = finalVideoConfig[status];
      this.finalVideo = true;
      this.handleVideo(finalVideo);
    }

  }, {
    template: 'simpleVideoBranching'
  });

  return VideoBranchingView;

});
