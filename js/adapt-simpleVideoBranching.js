define([
  'core/js/adapt',
  './simpleVideoBranchingView',
  './simpleVideoBranchingModel'
], function(Adapt, videoBranchingView, videoBranchingModel) {

  return Adapt.register('simpleVideoBranching', {
    view: videoBranchingView,
    model: videoBranchingModel
  });

});
