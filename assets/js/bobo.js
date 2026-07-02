(function () {
	'use strict';

	var body = document.body;
	var gateStatus = document.getElementById('gateStatus');
	var micButton = document.getElementById('micButton');
	var manualBlowButton = document.getElementById('manualBlowButton');
	var enterButton = document.getElementById('enterButton');
	var birthdayMusic = document.getElementById('birthdayMusic');
	var musicToggle = document.getElementById('musicToggle');
	var musicWanted = true;
	var musicVolume = 0.26;
	var hasBlown = false;
	var audioContext = null;
	var micStream = null;
	var analyser = null;
	var rafId = null;
	var loudFrames = 0;

	function setGateStatus(message) {
		if (gateStatus) gateStatus.textContent = message;
	}

	function updateMusicButton() {
		if (!musicToggle || !birthdayMusic) return;
		var isPlaying = !birthdayMusic.paused && !birthdayMusic.muted && birthdayMusic.volume > 0;
		musicToggle.classList.toggle('is-playing', isPlaying);
		musicToggle.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
		musicToggle.textContent = isPlaying ? '暂停音乐' : '播放音乐';
	}

	function startBirthdayMusic() {
		if (!birthdayMusic || !musicWanted) return;
		birthdayMusic.muted = false;
		birthdayMusic.volume = musicVolume;
		var playPromise = birthdayMusic.play();
		if (playPromise && typeof playPromise.then === 'function') {
			playPromise.then(updateMusicButton).catch(updateMusicButton);
		} else {
			updateMusicButton();
		}
	}

	function primeBirthdayMusicSilently(event) {
		if (!birthdayMusic || !musicWanted) return;
		if (event && event.target && event.target.closest && event.target.closest('#musicToggle')) return;
		if (!birthdayMusic.paused) return;
		birthdayMusic.muted = true;
		birthdayMusic.volume = 0;
		var playPromise = birthdayMusic.play();
		if (playPromise && typeof playPromise.then === 'function') {
			playPromise.then(updateMusicButton).catch(updateMusicButton);
		} else {
			updateMusicButton();
		}
	}

	function toggleBirthdayMusic() {
		if (!birthdayMusic) return;
		if (birthdayMusic.paused || birthdayMusic.muted || birthdayMusic.volume === 0) {
			musicWanted = true;
			startBirthdayMusic();
		} else {
			musicWanted = false;
			birthdayMusic.pause();
			updateMusicButton();
		}
	}

	function primeBirthdayMusic(event) {
		primeBirthdayMusicSilently(event);
	}

	function goToChronicle() {
		var target = document.getElementById('chronicle');
		if (target) {
			target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
		}
	}

	function blowOutCandles(source) {
		if (hasBlown) return;
		hasBlown = true;
		body.classList.add('candles-out');
		startBirthdayMusic();
		setGateStatus(source === 'mic' ? '听见啦，蜡烛灭了。生日门已经打开。' : '蜡烛灭了。生日门已经打开。');
		if (micStream) micStream.getTracks().forEach(function (track) { track.stop(); });
		if (rafId) cancelAnimationFrame(rafId);
	}

	function listenForBlow() {
		if (!analyser) return;
		var data = new Uint8Array(analyser.fftSize);

		function tick() {
			analyser.getByteTimeDomainData(data);
			var sum = 0;
			for (var i = 0; i < data.length; i++) {
				var v = (data[i] - 128) / 128;
				sum += v * v;
			}
			var rms = Math.sqrt(sum / data.length);
			if (rms > 0.18) loudFrames += 1;
			else loudFrames = Math.max(0, loudFrames - 1);

			if (loudFrames >= 5) {
				blowOutCandles('mic');
				return;
			}
			rafId = requestAnimationFrame(tick);
		}

		tick();
	}

	function startSpeechHint() {
		var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) return;

		try {
			var recognition = new SpeechRecognition();
			recognition.lang = 'zh-CN';
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.onresult = function (event) {
				var text = '';
				for (var i = event.resultIndex; i < event.results.length; i++) {
					text += event.results[i][0].transcript;
				}
				if (/生日快乐|快乐/.test(text)) {
					setGateStatus('听见“生日快乐”了。许好愿以后，轻轻吹一下蜡烛。');
				}
			};
			recognition.start();
		} catch (error) {
			return;
		}
	}

	function startMic() {
		primeBirthdayMusicSilently();
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			setGateStatus('这个浏览器不支持麦克风识别，可以直接轻点吹灭。');
			return;
		}

		setGateStatus('正在请求麦克风权限。');
		navigator.mediaDevices.getUserMedia({ audio: true })
			.then(function (stream) {
				micStream = stream;
				audioContext = new (window.AudioContext || window.webkitAudioContext)();
				var source = audioContext.createMediaStreamSource(stream);
				analyser = audioContext.createAnalyser();
				analyser.fftSize = 1024;
				source.connect(analyser);
				setGateStatus('麦克风已点亮。说生日快乐，或者对着屏幕轻轻吹气。');
				startSpeechHint();
				listenForBlow();
			})
			.catch(function () {
				setGateStatus('麦克风没有打开。没关系，可以用备用按钮吹灭。');
			});
	}

	if (birthdayMusic) {
		birthdayMusic.addEventListener('play', updateMusicButton);
		birthdayMusic.addEventListener('pause', updateMusicButton);
		birthdayMusic.addEventListener('ended', updateMusicButton);
	}
	if (musicToggle) musicToggle.addEventListener('click', toggleBirthdayMusic);
	document.addEventListener('pointerdown', primeBirthdayMusic, { once: true });
	document.addEventListener('keydown', primeBirthdayMusic, { once: true });
	if (micButton) micButton.addEventListener('click', startMic);
	if (manualBlowButton) manualBlowButton.addEventListener('click', function () {
		blowOutCandles('manual');
	});
	if (enterButton) enterButton.addEventListener('click', function () {
		startBirthdayMusic();
		if (!hasBlown) setGateStatus('先偷看也可以，蜡烛等会儿再吹。');
	});
	updateMusicButton();

	var memoryCards = Array.prototype.slice.call(document.querySelectorAll('.memory-card'));
	var collectionHeart = document.getElementById('collectionHeart');
	var collectedCount = document.getElementById('collectedCount');
	var totalCards = document.getElementById('totalCards');
	var resetProgressButton = document.getElementById('resetProgressButton');
	var collectionFloat = document.getElementById('collectionFloat');
	var floatCollectedCount = document.getElementById('floatCollectedCount');
	var floatTotalCards = document.getElementById('floatTotalCards');
	var collectionClose = document.getElementById('collectionClose');
	var chroniclePanel = document.querySelector('.chronicle-panel');
	var collectionKey = 'bobo-birthday-collected-cards';
	var collectionScrim = null;
	var collectionOriginalParent = null;
	var collectionOriginalNext = null;

	function getCollectedCards() {
		try {
			var ids = JSON.parse(localStorage.getItem(collectionKey) || '[]');
			return ids.filter(function (id) {
				return memoryCards.some(function (card) { return card.dataset.card === id; });
			});
		} catch (error) {
			return [];
		}
	}

	function saveCollectedCards(ids) {
		localStorage.setItem(collectionKey, JSON.stringify(ids));
	}

	function resetCollectedCards() {
		saveCollectedCards([]);
		memoryCards.forEach(function (card) {
			card.classList.remove('is-open', 'is-solved', 'is-wrong-pulse');
			card.querySelectorAll('.choices button').forEach(function (button) {
				button.disabled = false;
				button.classList.remove('is-correct', 'is-wrong');
			});
			var feedback = card.querySelector('.answer-feedback');
			if (feedback) feedback.remove();
			var confetti = card.querySelector('.confetti-pop');
			if (confetti) confetti.remove();
		});
		renderCollection();
		if (resetProgressButton) {
			resetProgressButton.textContent = '已重置';
			window.setTimeout(function () { resetProgressButton.textContent = '重置'; }, 900);
		}
	}

	function getCardTitle(card) {
		var year = card.querySelector('.year');
		var title = card.querySelector('h3');
		return (year ? year.textContent + ' ' : '') + (title ? title.textContent : '');
	}

	function prepareReveal(card) {
		var reveal = card.querySelector('.memory-reveal');
		if (!reveal) return;

		if (!reveal.querySelector('.reveal-copy')) {
			var copy = document.createElement('div');
			copy.className = 'reveal-copy';
			while (reveal.firstChild) copy.appendChild(reveal.firstChild);
			reveal.appendChild(copy);
		}

		if (!reveal.querySelector('.answer-photo')) {
			var figure = document.createElement('figure');
			figure.className = 'answer-photo';
			var imagePath = card.dataset.image;
			if (imagePath) {
				var image = document.createElement('img');
				image.src = imagePath;
				image.alt = getCardTitle(card);
				image.loading = 'lazy';
				image.decoding = 'async';
				figure.appendChild(image);
			} else {
				var label = document.createElement('span');
				label.textContent = '照片待补';
				figure.appendChild(label);
			}
			reveal.insertBefore(figure, reveal.firstChild);
		}
	}

	function setAnswerFeedback(card, type, message) {
		var feedback = card.querySelector('.answer-feedback');
		if (!feedback) {
			feedback = document.createElement('div');
			feedback.className = 'answer-feedback';
			var choices = card.querySelector('.choices');
			if (choices) choices.insertAdjacentElement('afterend', feedback);
		}
		feedback.className = 'answer-feedback is-' + type;
		feedback.textContent = message;
	}

	function burstConfetti(card) {
		var old = card.querySelector('.confetti-pop');
		if (old) old.remove();

		var colors = ['#ffe2a1', '#ffffff', '#f3a0c1', '#c6b7ff'];
		var pop = document.createElement('div');
		pop.className = 'confetti-pop';
		for (var i = 0; i < 18; i++) {
			var bit = document.createElement('span');
			bit.className = 'confetti-bit';
			bit.style.setProperty('--x', (42 + Math.random() * 18) + '%');
			bit.style.setProperty('--y', (34 + Math.random() * 18) + '%');
			bit.style.setProperty('--dx', (-120 + Math.random() * 240) + 'px');
			bit.style.setProperty('--dy', (-90 + Math.random() * 190) + 'px');
			bit.style.setProperty('--rot', (-160 + Math.random() * 320) + 'deg');
			bit.style.setProperty('--d', (Math.random() * 0.12) + 's');
			bit.style.setProperty('--c', colors[i % colors.length]);
			pop.appendChild(bit);
		}
		card.appendChild(pop);
		window.setTimeout(function () { pop.remove(); }, 1100);
	}

	function getCollectionCard() {
		return collectionHeart && collectionHeart.closest('.collection-card');
	}

	function ensureCollectionScrim() {
		if (collectionScrim) return collectionScrim;
		collectionScrim = document.createElement('div');
		collectionScrim.className = 'collection-modal-scrim';
		document.body.appendChild(collectionScrim);
		collectionScrim.addEventListener('click', closeCollectionModal);
		return collectionScrim;
	}

	function openCollectionModal() {
		var card = getCollectionCard();
		if (!card) return;
		var scrim = ensureCollectionScrim();
		if (!collectionOriginalParent) {
			collectionOriginalParent = card.parentNode;
			collectionOriginalNext = card.nextSibling;
		}
		if (card.parentNode !== document.body) document.body.appendChild(card);
		card.classList.add('is-modal-open');
		scrim.classList.add('is-visible');
		document.body.classList.add('collection-modal-open');
		if (collectionFloat) collectionFloat.setAttribute('aria-expanded', 'true');
	}

	function closeCollectionModal() {
		var card = getCollectionCard();
		if (card) {
			card.classList.remove('is-modal-open');
			if (collectionOriginalParent && card.parentNode === document.body) {
				collectionOriginalParent.insertBefore(card, collectionOriginalNext);
			}
		}
		if (collectionScrim) collectionScrim.classList.remove('is-visible');
		document.body.classList.remove('collection-modal-open');
		if (collectionFloat) collectionFloat.setAttribute('aria-expanded', 'false');
	}

	function updateCollectionFloatVisibility() {
		if (!collectionFloat || !chroniclePanel) return;
		var rect = chroniclePanel.getBoundingClientRect();
		var horizontalVisible = rect.left < window.innerWidth * 0.75 && rect.right > window.innerWidth * 0.25;
		var verticalVisible = rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25;
		var visible = horizontalVisible && verticalVisible;
		collectionFloat.classList.toggle('is-visible', visible);
	}

	function shootCollectionBeam(card) {
		updateCollectionFloatVisibility();
		if (!collectionFloat) return;
		var from = card.getBoundingClientRect();
		var to = collectionFloat.getBoundingClientRect();
		if (to.width === 0 || to.height === 0) return;

		var beam = document.createElement('span');
		beam.className = 'collection-beam';
		beam.style.setProperty('--from-x', (from.left + from.width * 0.5) + 'px');
		beam.style.setProperty('--from-y', (from.top + Math.min(from.height * 0.42, 260)) + 'px');
		beam.style.setProperty('--to-x', (to.left + to.width * 0.5) + 'px');
		beam.style.setProperty('--to-y', (to.top + to.height * 0.5) + 'px');
		document.body.appendChild(beam);
		collectionFloat.classList.remove('is-charging');
		void collectionFloat.offsetWidth;
		collectionFloat.classList.add('is-charging');
		window.setTimeout(function () {
			beam.remove();
			collectionFloat.classList.remove('is-charging');
		}, 1240);
	}

	function renderCollection() {
		if (!collectionHeart) return;
		var ids = getCollectedCards();
		collectionHeart.innerHTML = '';
		if (totalCards) totalCards.textContent = String(memoryCards.length);
		if (collectedCount) collectedCount.textContent = String(ids.length);
		if (floatTotalCards) floatTotalCards.textContent = String(memoryCards.length);
		if (floatCollectedCount) floatCollectedCount.textContent = String(ids.length);

		memoryCards.forEach(function (card, index) {
			var slot = document.createElement('div');
			var cardId = card.dataset.card;
			var isCollected = ids.indexOf(cardId) !== -1;
			slot.className = 'collection-slot' + (isCollected ? ' is-collected' : '');

			if (isCollected && card.dataset.image) {
				var image = document.createElement('img');
				image.src = card.dataset.image;
				image.alt = getCardTitle(card);
				image.loading = 'lazy';
				image.decoding = 'async';
				slot.appendChild(image);
			}

			var label = document.createElement('span');
			label.textContent = isCollected ? (card.querySelector('h3') || card).textContent : String(index + 1);
			slot.appendChild(label);
			collectionHeart.appendChild(slot);
		});
	}

		function collectCard(card) {
			var id = card.dataset.card;
			var ids = getCollectedCards();
			if (ids.indexOf(id) === -1) {
				ids.push(id);
				saveCollectedCards(ids);
			}
			renderCollection();
			var collectionCard = getCollectionCard();
			if (collectionCard) {
				collectionCard.classList.remove('is-flashing');
				void collectionCard.offsetWidth;
				collectionCard.classList.add('is-flashing');
				window.setTimeout(function () { collectionCard.classList.remove('is-flashing'); }, 900);
			}
			shootCollectionBeam(card);
		}

	memoryCards.forEach(function (card) {
		var buttons = card.querySelectorAll('.choices button');
		var correct = card.querySelector('.choices button[data-correct="true"]');
		var isStored = getCollectedCards().indexOf(card.dataset.card) !== -1;

		if (isStored && correct) {
			prepareReveal(card);
			card.classList.add('is-open', 'is-solved');
			correct.classList.add('is-correct');
			buttons.forEach(function (item) { item.disabled = true; });
			setAnswerFeedback(card, 'correct', '已经收进照片墙。');
		}

		buttons.forEach(function (button) {
			button.addEventListener('click', function () {
				if (card.classList.contains('is-solved')) return;

				if (button.dataset.correct === 'true') {
					prepareReveal(card);
					button.classList.add('is-correct');
					card.classList.add('is-open', 'is-solved');
					buttons.forEach(function (item) { item.disabled = true; });
					setAnswerFeedback(card, 'correct', '答对啦，照片墙又亮了一张。');
					collectCard(card);
					burstConfetti(card);
				} else {
					button.classList.add('is-wrong');
					button.disabled = true;
					card.classList.remove('is-wrong-pulse');
					void card.offsetWidth;
					card.classList.add('is-wrong-pulse');
					setAnswerFeedback(card, 'wrong', '不是这一页，再翻一翻记忆。');
				}
			});
		});
	});

	renderCollection();

	if (resetProgressButton) resetProgressButton.addEventListener('click', resetCollectedCards);
	if (collectionFloat) collectionFloat.addEventListener('click', openCollectionModal);
	if (collectionClose) collectionClose.addEventListener('click', closeCollectionModal);
	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape') closeCollectionModal();
	});
	window.addEventListener('scroll', updateCollectionFloatVisibility, { passive: true });
	window.addEventListener('resize', updateCollectionFloatVisibility);
	updateCollectionFloatVisibility();

	var questionText = document.getElementById('questionText');
	var questionCard = document.getElementById('questionCard');
	var drawQuestionButton = document.getElementById('drawQuestionButton');
	var questions = [
		'今天这一刻，你最想先记住什么？',
		'如果把今晚写成一句话，你会怎么写？',
		'现在最想对对方说的一句谢谢是什么？',
		'这顿生日夜里，最让你心软的细节是什么？',
		'如果今晚有个慢镜头，会停在谁身上？',
		'今天有没有哪一秒，让你觉得自己被好好爱着？',
		'如果把我们这几年拍成电影，你最想重看哪一幕？',
		'你第一次觉得“就是这个人了”，大概是什么时候？',
		'哪一次旅行或散步，至今还会突然想起？',
		'你最爱翻出来重说的一段老故事是哪段？',
		'结婚后，哪一刻让你突然更懂对方了？',
		'哪个小习惯，是后来才悄悄变成了“我们”的习惯？',
		'你觉得我们一起经历过最像电影的一幕是什么？',
		'哪个瞬间让你觉得，家开始有了形状？',
		'如果把过去这些年选成一张相册，封面会是哪张？',
		'我们一起经历过的事里，你最喜欢哪一段回忆？',
		'你觉得我们一起做过最“疯狂”但回想起来很开心的一件事是什么？',
		'你最喜欢我们哪一张合照？为什么偏偏是那张？',
		'你人生里到目前为止，有哪些时刻会被你称作高光时刻？',
		'你小时候最喜欢的玩具、游戏或者小爱好是什么？',
		'你小时候有哪些习惯，长大以后还留在你身上？',
		'你童年里有没有一件现在想起来还会笑的事？',
		'如果回头看小时候的自己，你最想对那时的你说什么？',
		'你还记得自己的第一份工作吗？那时候发生过什么有意思的事？',
		'当我在你身边时，你心里通常会有一种什么感觉？',
		'你最喜欢我们之间哪些小细节？',
		'你什么时候最想一个人待一会儿？那通常是在恢复什么？',
		'你觉得自己的底线是什么？这些想法是怎么慢慢形成的？',
		'你生气的时候，最希望我怎么陪你、怎么沟通？',
		'最近有没有什么事让你有点烦，或者放在心上？我能怎么帮你？',
		'你觉得爱一个人，对你来说是一种什么感觉？',
		'你觉得这几年我们有没有越来越像彼此？像在哪些地方？',
		'如果用五个词形容我，你会选哪五个？',
		'你觉得我是个内心有力量的人吗？你是从哪些时候感受到的？',
		'在我们的相处里，什么最容易让你感到被理解、被接住？',
		'你觉得我的哪些地方最值得被好好珍惜？',
		'什么样的人，会真正成为你愿意深交的朋友？',
		'未来一年，你最想把哪件小事过得更好？',
		'如果给我们的生活加一个新仪式，会是什么？',
		'你希望十年后的我们，还保留什么样的默契？',
		'未来最想一起完成的一次慢旅行去哪里？',
		'如果家里多出一个角落，你希望它用来做什么？',
		'你最期待我们一起变成怎样的大人？',
		'将来某个普通夜晚，你最想它长什么样？',
		'如果未来能提前点菜，你最想点哪种日子？',
		'如果以后我们有一段较长时间要分开生活，你觉得怎样才能把感情照顾好？',
		'如果我们以后专门为彼此留一个固定的小节日，你想怎么过？',
		'你觉得一段幸福、踏实的婚姻，真实地看起来像什么样？',
		'婚姻里最重要的几个条件，你会把什么排在前面？',
		'你的爱情观里，哪些部分受过原生家庭影响？哪些是后来自己长出来的？',
		'你和父母那一代相比，对亲密关系最大的不同看法是什么？',
		'如果以后家里有一个重要决定，你最希望我们用什么方式一起商量？',
		'如果完全不考虑现实压力，你最想尝试一种怎样的职业或生活方式？',
		'小无限最近哪句话或哪个动作，最像家里的小宇宙中心？',
		'你觉得小无限最像你，还是最像妈妈？',
		'这个家里最有安全感味道的瞬间是什么？',
		'你最喜欢我们家的哪一种热闹？',
		'如果给家里每位成员分配一个星球，会怎么分？',
		'你觉得我们这个家，最独特的气质是什么？',
		'猫们如果会开家庭会议，它们会先投诉什么？',
		'如果突然送你一百万，你第一反应最想拿来做什么？',
		'如果你可以拥有一种超能力，你最想选哪一种？为什么？',
		'如果我们一起去一个像游戏或电影一样的世界生活一周，你最想选哪种世界？',
		'如果我们忽然变成两只猫，要怎么在城市里把日子过好？',
		'如果送你一座大房子，你最想把它布置成什么样？',
		'如果我们设计一辆只属于我们的旅行车，你希望里面一定有什么？',
		'长途旅行的时候，你更像负责做计划的人，还是负责享受过程的人？',
		'如果让你挑一种一直想学、但还没认真学的技能，你会选什么？',
		'如果以后安排一次只属于两个人的轻松约会，你最想怎么过这一天？',
		'最近这一两年，有哪些事是真正让你成长的？',
		'你觉得我们可以怎样更好地支持彼此的个人成长？',
		'到目前为止，生活里谁曾经给过你很大的帮助？',
		'你最引以为傲的一件事是什么？',
		'你见过的优秀的人，身上通常有什么共同特质？',
		'你现在最想继续长出来的一种能力是什么？',
		'当你对未来有点不确定的时候，什么能让你重新安定下来？',
		'波波，今天你最想对自己说什么？',
		'波波，哪件事是你越长大越觉得珍贵的？',
		'波波，你最想把哪种温柔留给未来？',
		'波波，你心里那个家的样子是什么样？',
		'波波，这些年你最想感谢的自己是哪一面？',
		'波波，如果把人生下一章写得更松弛一点，你想怎么写？',
		'波波，你希望我们一起把哪种日子过成习惯？'
	];
	var questionDeck = [];

	function drawQuestion() {
		if (!questionDeck.length) questionDeck = questions.slice();
		var index = Math.floor(Math.random() * questionDeck.length);
		return questionDeck.splice(index, 1)[0];
	}

	if (drawQuestionButton) {
		drawQuestionButton.addEventListener('click', function () {
			var question = drawQuestion();
			if (questionCard) {
				questionCard.classList.remove('is-idle', 'is-dealing', 'is-drawn');
				void questionCard.offsetWidth;
			}
			if (questionText) questionText.textContent = question;
			if (questionCard) {
				questionCard.classList.add('is-dealing', 'is-drawn');
				window.setTimeout(function () { questionCard.classList.remove('is-dealing'); }, 820);
			}
			drawQuestionButton.textContent = '再抽一题';
		});
	}

	var wishForm = document.getElementById('wishForm');
	var wishInput = document.getElementById('wishInput');
	var wishList = document.getElementById('wishList');
	var wishPool = document.getElementById('wishPool');
	var wishStatus = document.getElementById('wishStatus');
	var wishSubmitButton = wishForm ? wishForm.querySelector('button[type="submit"]') : null;
	var storageKey = 'bobo-birthday-wishes';
	var wishDropTimer = null;

	function getWishes() {
		try {
			return JSON.parse(localStorage.getItem(storageKey) || '[]');
		} catch (error) {
			return [];
		}
	}

	function saveWishes(wishes) {
		localStorage.setItem(storageKey, JSON.stringify(wishes.slice(-6)));
	}

	function renderWishes() {
		if (!wishList) return;
		var wishes = getWishes();
		wishList.innerHTML = '';
		wishes.slice().reverse().forEach(function (wish) {
			var item = document.createElement('div');
			item.className = 'wish-item';
			item.textContent = wish;
			wishList.appendChild(item);
		});
	}

	function setWishStatus(message, type) {
		if (!wishStatus) return;
		wishStatus.textContent = message || '';
		wishStatus.className = 'wish-status' + (type ? ' is-' + type : '');
	}

	function getWishApiUrl() {
		var config = window.BOBO_BIRTHDAY_CONFIG || {};
		if (wishForm && wishForm.dataset.wishApiUrl) return wishForm.dataset.wishApiUrl;
		return config.wishApiUrl || '/api/wishes';
	}

	function submitWishToServer(value) {
		if (!window.fetch) return Promise.reject(new Error('Current browser does not support fetch'));
		return fetch(getWishApiUrl(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				wish: value,
				source: 'birthday-site',
				page: window.location.href
			})
		}).then(function (response) {
			return response.json().catch(function () {
				return {};
			}).then(function (data) {
				if (!response.ok || !data.ok) {
					throw new Error(data.error || 'Wish API failed');
				}
				return data;
			});
		});
	}

	function setWishSubmitting(isSubmitting) {
		if (!wishSubmitButton) return;
		wishSubmitButton.disabled = isSubmitting;
		wishSubmitButton.textContent = isSubmitting ? '正在许愿' : '许愿完毕';
	}

	if (wishForm) {
		wishForm.addEventListener('submit', function (event) {
			event.preventDefault();
			var value = wishInput.value.trim();
			if (!value) return;
			var wishes = getWishes();
			wishes.push(value);
			saveWishes(wishes);
			renderWishes();
			if (wishPool) {
				wishPool.classList.remove('is-dropping');
				void wishPool.offsetWidth;
				wishPool.classList.add('is-dropping');
				if (wishDropTimer) window.clearTimeout(wishDropTimer);
				wishDropTimer = window.setTimeout(function () {
					wishPool.classList.remove('is-dropping');
				}, 2300);
			}
			wishInput.value = '';
			setWishSubmitting(true);
			setWishStatus('愿望正在落进水心。', 'saving');
			submitWishToServer(value).then(function () {
				setWishStatus('愿望已经沉进水光里。', 'success');
			}).catch(function () {
				setWishStatus('愿望已经悄悄收好。', 'success');
			}).finally(function () {
				setWishSubmitting(false);
			});
		});
	}

	renderWishes();

	var certButton = document.getElementById('certButton');
	var certificate = document.getElementById('certificate');
	var certSeal = document.getElementById('certSeal');

	if (certButton && certificate) {
		certButton.addEventListener('click', function () {
			certificate.classList.remove('is-stamping');
			void certificate.offsetWidth;
			certificate.classList.add('is-sealed');
			certificate.classList.add('is-stamping');
			window.setTimeout(function () {
				certificate.classList.remove('is-stamping');
			}, 860);
			if (certSeal) certSeal.setAttribute('aria-label', '已认证');
		});
	}

	var finalPanel = document.querySelector('.final-panel');
	var finalCelebrated = false;

	function prefersReducedMotion() {
		return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function launchFinaleConfetti() {
		if (!finalPanel || prefersReducedMotion()) return;
		var colors = ['#ffe2a1', '#ffffff', '#f3a0c1', '#c6b7ff', '#ffd8e3'];
		var burst = document.createElement('div');
		burst.className = 'final-confetti-burst';

		for (var i = 0; i < 32; i++) {
			var piece = document.createElement('span');
			var angle = (-150 + Math.random() * 300) * Math.PI / 180;
			var distance = 130 + Math.random() * 300;
			var dx = Math.cos(angle) * distance;
			var dy = Math.sin(angle) * distance - 80 - Math.random() * 90;
			piece.style.setProperty('--dx', dx.toFixed(1) + 'px');
			piece.style.setProperty('--dy', dy.toFixed(1) + 'px');
			piece.style.setProperty('--rot', (-240 + Math.random() * 520).toFixed(1) + 'deg');
			piece.style.setProperty('--w', (0.28 + Math.random() * 0.34).toFixed(2) + 'rem');
			piece.style.setProperty('--h', (0.62 + Math.random() * 0.72).toFixed(2) + 'rem');
			piece.style.setProperty('--radius', Math.random() > 0.58 ? '999px' : '0.12rem');
			piece.style.setProperty('--c', colors[i % colors.length]);
			piece.style.setProperty('--delay', (Math.random() * 0.42).toFixed(2) + 's');
			burst.appendChild(piece);
		}

		finalPanel.appendChild(burst);
		window.setTimeout(function () { burst.remove(); }, 2900);
	}

	function revealFinalPanel() {
		if (!finalPanel || finalCelebrated) return;
		finalCelebrated = true;
		finalPanel.classList.add('is-visible');
		window.setTimeout(launchFinaleConfetti, 260);
	}

	if (finalPanel) {
		if ('IntersectionObserver' in window) {
			var finalObserver = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
						revealFinalPanel();
						finalObserver.disconnect();
					}
				});
			}, { threshold: [0.35, 0.58] });
			finalObserver.observe(finalPanel);
		} else {
			finalPanel.classList.add('is-visible');
		}
	}

	var wrapper = document.getElementById('wrapper');
	var dragState = null;
	var dragFrame = null;

	function isDesktopHorizontal() {
		return window.matchMedia('(min-width: 737px)').matches;
	}

	function shouldIgnoreDrag(target) {
		return !!target.closest('button, a, input, textarea, select, label, form');
	}

	function scheduleDragScroll(left) {
		if (dragFrame) cancelAnimationFrame(dragFrame);
		dragFrame = requestAnimationFrame(function () {
			document.documentElement.scrollLeft = left;
			document.body.scrollLeft = left;
			dragFrame = null;
		});
	}

	if (wrapper && window.PointerEvent) {
		wrapper.addEventListener('pointerdown', function (event) {
			if (!isDesktopHorizontal() || shouldIgnoreDrag(event.target) || event.button !== 0) return;
			dragState = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startLeft: window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
				moved: false
			};
			wrapper.classList.add('is-lite-dragging');
			wrapper.setPointerCapture(event.pointerId);
		});

		wrapper.addEventListener('pointermove', function (event) {
			if (!dragState || dragState.pointerId !== event.pointerId) return;
			var nextLeft = dragState.startLeft + dragState.startX - event.clientX;
			if (Math.abs(event.clientX - dragState.startX) > 4) dragState.moved = true;
			scheduleDragScroll(nextLeft);
			event.preventDefault();
		}, { passive: false });

		function endLiteDrag(event) {
			if (!dragState || dragState.pointerId !== event.pointerId) return;
			if (wrapper.hasPointerCapture(event.pointerId)) wrapper.releasePointerCapture(event.pointerId);
			wrapper.classList.remove('is-lite-dragging');
			dragState = null;
		}

		wrapper.addEventListener('pointerup', endLiteDrag);
		wrapper.addEventListener('pointercancel', endLiteDrag);
	}

	window.addEventListener('wheel', function (event) {
		if (!isDesktopHorizontal()) return;
		if (event.ctrlKey) return;

		var unit = 1;
		if (event.deltaMode === 1) unit = 40;
		else if (event.deltaMode === 2) unit = window.innerWidth;

		var deltaX = event.deltaX * unit;
		var deltaY = event.deltaY * unit;
		var hasHorizontalIntent = Math.abs(deltaX) > 0.5;
		var delta = hasHorizontalIntent ? deltaX : deltaY;

		if (Math.abs(delta) < 0.5) return;
		window.scrollBy({
			left: delta * (hasHorizontalIntent ? 0.36 : 0.3),
			top: 0,
			behavior: 'auto'
		});
		event.preventDefault();
	}, { passive: false });
})();
