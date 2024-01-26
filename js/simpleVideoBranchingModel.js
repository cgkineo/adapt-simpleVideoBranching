define([
  'core/js/models/questionModel'
], function(QuestionModel) {

  var VideoBranchingModel = QuestionModel.extend({

    init: function() {
      QuestionModel.prototype.init.call(this);
      this.set({
        body: '',
        _selectedItems: [],
        _items: []
      });

      // Add indexes for ease of labelling
      var mediaIndex = 0; var questionIndex = 0;
      this.get('_items').forEach(function(item, index) {
        item._index = index;

        if (item._media) {
          item._mediaIndex = mediaIndex++;
          return;
        }

        if (item._options) {
          item._questionIndex = questionIndex++;

        }
      });

      // totals are useful to have too, set initial player state attributes
      this.set({
        _isMediaEnded: false,
        _isMediaPlaying: false,
        _media: {
          cc: [],
          mp4: ' '// prevent console warning 'No media is selected in components.json'
        },
        _mediaCount: mediaIndex,
        _questionCount: questionIndex
      });
    },

    reset: function() {
      this.set({
        _selectedItems: []
      });

      this.get('_items').forEach(function(item) {
        if (item._options === undefined) return;

        item._options.forEach(function(option) {
          option._isSelected = false;
        });
      });

      QuestionModel.prototype.reset.apply(this, ['soft', true]);
    },

    resetOptions: function() {
      var question = this.get('_question');

      question._options.forEach(function(option) {
        option._isSelected = false;
      });

      this.set('_isCorrect', null);
    },

    setupQuestion: function() {
      var currentItem = this.get('_question');

      var selectable = currentItem._selectable || 1;
      currentItem._isRadio = (selectable === 1);

      this.set('_selectable', selectable);

      this.setupOptionIndexes(currentItem);

      this.setupRandomisation(currentItem);
    },

    setupOptionIndexes: function(currentItem) {
      var options = currentItem._options;
      options.forEach(function(option, index) {
        if (option._index !== undefined) return;
        option._index = index;
      });
    },

    setupRandomisation: function(currentItem) {
      if (!this.get('_isRandom')) return;

      currentItem._options = _.shuffle(currentItem._options);
    },

    deselectAllItems: function() {
      var currentItem = this.get('_question');

      var options = currentItem._options;
      options.forEach(function(item) {
        item._isSelected = false;
      });
    },

    resetItems: function() {
      this.set({
        _selectedItems: [],
        _isAtLeastOneCorrectSelection: false
      });
    }

  });

  return VideoBranchingModel;

});
