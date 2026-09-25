/**
 * L.Polyline.SnakeAnim
 * 仅解决缩放适配问题：通过比例追踪（Fraction Tracking）替代固定像素距离追踪
 */

L.Polyline.include({

	// 状态变量
	_snakingRings: 0,
	_snakingVertices: 0,
	_snakingFraction: 0, // 当前线段已完成的地理比例 (0-1)
	_snaking: false,

	snakeIn: function(){

		if (this._snaking || !this._map) return;

		if ( !('performance' in window) || !('now' in window.performance)) {
			return;
		}

		this._snaking = true;
		this._snakingTime = performance.now();
		this._snakingVertices = this._snakingRings = this._snakingFraction = 0;

		if (!this._snakeLatLngs) {
			this._snakeLatLngs = L.LineUtil.isFlat(this._latlngs) ?
				[ this._latlngs ] :
				this._latlngs ;
		}

		// 初始化：只保留第一个顶点
		this._latlngs = [[ this._snakeLatLngs[0][0] ]];

		this._update();
		this._snake();
		this.fire('snakestart');
		return this;
	},


	_snake: function(){

		if (!this._snaking || !this._map) return;

		var now = performance.now();
		var diff = now - this._snakingTime;	// 毫秒
		var forward = diff * this.options.snakingSpeed / 1000;	// 本帧应移动的像素距离
		this._snakingTime = now;

		// 移除上一帧生成的临时插值“蛇头”
		if (this._latlngs[this._snakingRings].length > (this._snakingVertices + 1)) {
			this._latlngs[this._snakingRings].pop();
		}

		return this._snakeForward(forward);
	},

	_snakeForward: function(forward) {

		if (!this._map) return;

		// 获取当前顶点和下一个顶点的屏幕像素坐标
		var p1 = this._map.latLngToContainerPoint(this._snakeLatLngs[this._snakingRings][this._snakingVertices]);
		var p2 = this._map.latLngToContainerPoint(this._snakeLatLngs[this._snakingRings][this._snakingVertices + 1]);

		var distance = p1.distanceTo(p2); // 当前缩放等级下的像素长度

		// 计算本帧移动的像素占总长的比例
		var fractionStep = distance > 0 ? (forward / distance) : 1;
		this._snakingFraction += fractionStep;

		if (this._snakingFraction >= 1) {
			// 超过当前段，跳到下一个顶点
			this._latlngs[this._snakingRings].push(this._snakeLatLngs[this._snakingRings][this._snakingVertices + 1]);
			this._snakingVertices++;
			
			// 计算溢出的距离（用于下一段递归）
			var overflowPixels = (this._snakingFraction - 1) * distance;
			this._snakingFraction = 0;

			if (this._snakingVertices >= this._snakeLatLngs[this._snakingRings].length - 1 ) {
				if (this._snakingRings >= this._snakeLatLngs.length - 1 ) {
					return this._snakeEnd();
				} else {
					this._snakingVertices = 0;
					this._snakingRings++;
					this._latlngs[this._snakingRings] = [ this._snakeLatLngs[this._snakingRings][0] ];
				}
			}

			// 如果仍有剩余像素距离，继续递归
			return this._snakeForward(overflowPixels);
		}

		// 根据比例进行地理插值
		var pStart = this._snakeLatLngs[this._snakingRings][this._snakingVertices];
		var pEnd = this._snakeLatLngs[this._snakingRings][this._snakingVertices + 1];
		
		var lat = pStart.lat + (pEnd.lat - pStart.lat) * this._snakingFraction;
		var lng = pStart.lng + (pEnd.lng - pStart.lng) * this._snakingFraction;
		
		this._latlngs[this._snakingRings].push(L.latLng(lat, lng));

		this.setLatLngs(this._latlngs);
		this.fire('snake');
		L.Util.requestAnimFrame(this._snake, this);
	},

	_snakeEnd: function() {

		this.setLatLngs(this._snakeLatLngs);
		this._snaking = false;
		this.fire('snakeend');

	}

});


L.Polyline.mergeOptions({
	snakingSpeed: 200	// 像素/秒
});


L.LayerGroup.include({

	_snakingLayers: [],
	_snakingLayersDone: 0,

	snakeIn: function() {

		if ( !('performance' in window) || !('now' in window.performance) || !this._map || this._snaking) {
			return;
		}

		this._snaking = true;
		this._snakingLayers = [];
		this._snakingLayersDone = 0;
		for (var id in this._layers) {
			this._snakingLayers.push(this._layers[id]);
		}
		this.clearLayers();

		this.fire('snakestart');
		return this._snakeNext();
	},

	_snakeNext: function() {

		if (this._snakingLayersDone >= this._snakingLayers.length) {
			this.fire('snakeend');
			this._snaking = false;
			return;
		}

		var currentLayer = this._snakingLayers[this._snakingLayersDone];
		this._snakingLayersDone++;

		this.addLayer(currentLayer);
		if (currentLayer.snakeIn) {
			currentLayer.once('snakeend', function(){
				setTimeout(this._snakeNext.bind(this), this.options.snakingPause);
			}, this);
			currentLayer.snakeIn();
		} else {
			setTimeout(this._snakeNext.bind(this), this.options.snakingPause);
		}

		this.fire('snake');
		return this;
	}

});

L.LayerGroup.mergeOptions({
	snakingPause: 200
});