//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    log: '',
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },
  onLoad: function () {
    wx.setNavigationBarTitle({
      title: 'MPSignature',
    });
    this.signatureComp = this.selectComponent("#mpSignatureComp")
  },
  onTapClear: function(e) {
    if (!this.signatureComp) {
      return;
    }
    this.signatureComp.clearCanvas();
  },
  onTapOK: function(e) {
    if (!this.signatureComp) {
      return;
    }
    this.signatureComp.genSignatureImg(function(code, wxTempFilePath) {
      if (0 != code) {
        console.log('genSignature failed:' + code);
        return;
      }
      console.log('genSignature success:' + wxTempFilePath);
    });
  },

})
