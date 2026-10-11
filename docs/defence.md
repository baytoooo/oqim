# Защита OQIM: речь, показ и вопросы

По сданной презентации: `deck/submitted/OQIM_defence.pdf` (11 слайдов). 7 минут выступления, потом 3 минуты вопросов. Говорим по-английски (текст ниже можно читать как есть), подсказки для себя по-русски. Режим: **Startup**, сказать вслух на первом слайде, правила это требуют.

Кто говорит: **Amal** слайды 1, 2, 7, 11 (около 1:55), **Komronbek** слайды 3, 6, 8 (около 2:55), **Aziza** слайды 4, 5, 9, 10 (около 2:10). Komronbek всё время за ноутбуком: листает слайды и переключает вкладки, даже когда говорят другие.

В презентации нет двух новых вещей: разметки мест по своему фото и счётчика у рекламного щита. Их показываем живьём на сайте: фото на слайде 4, щит на слайде 8.

## За 10 минут до выхода

Открыть в Chrome на ноутбуке, каждую в своей вкладке, в этом порядке:

1. Презентация `deck/submitted/OQIM_defence.pdf`, полный экран.
2. https://oqim-audit.vercel.app/tracker : дать загрузиться, нажать Pause, ползунок в начало.
3. https://oqim-audit.vercel.app/parking : дождаться, пока детектор посчитает первый кадр (внизу строка "detector runs ... in N s"). На рабочем столе держать своё фото парковки: сфотографировать любую парковку у WIUT заранее, сверху и издалека.
4. https://oqim-audit.vercel.app/city : открыть заранее, карта считается 10 to 15 секунд.
5. https://oqim-audit.vercel.app/banner : нажать пример **C3905**, потом "Count the vehicles", дождаться результата (около минуты) и не закрывать вкладку. На защите нажимаем только Play на видео.

Если интернет плохой: на слайдах 3 и 5 уже есть картинки, показываем по ним и называем адрес страницы.

## Речь по слайдам (7:00)

Заметки внутри OQIM_defence.pptx старые и длиннее (около 10 минут текста). Показываем PDF и говорим по этой странице, не по заметкам.

### Слайд 1. OQIM, титул. Amal, 0:00 to 0:10

> Good morning. We are team PariVision, Webster University in Tashkent. Our mode is Startup. OQIM is a parking tracker on cameras that already exist.

### Слайд 2. Drivers circle because they cannot see free spaces. Amal, 0:10 to 0:45

> A driver picks a car park by habit, finds it full at the gate, and drives on, adding to the traffic. INRIX found US drivers spend 17 hours a year looking for parking. Only about 5% of off-street car parks publish their free spaces. Tashkent started paid street parking in May 2025 and plans 13,208 spaces on 86 streets. Measuring spaces works: SFpark cut cruising by half on its pilot blocks. Our user is the driver; car park operators and the city pay.

### Слайд 3. Free spaces now, and when you arrive (живой показ /tracker). Komronbek, 0:45 to 2:25

Переключиться на вкладку /tracker и нажать Play.

> These are three real car park cameras from the PKLot dataset, about a frame every five minutes, one morning each. Watch the big car park fill up. Every space is read from the frame: when it turns red, a car came in; green, a car left.
>
> The dataset labels only part of each car park. The dashed spaces have no label: the tracker found them where a car stayed twenty minutes. That is 198 more spaces.
>
> Against the hand labels, 98.8% of 6,844 space readings are right, and the free count is off by one space in the median.

Ползунок на 10:13. Показать блок "Ask now" и блок "Many drivers asking at the same time" (40 водителей).

> On the right: which car park to drive to, with the spaces free when you arrive, not now. Ten minutes ahead the forecast is off by 3.0 spaces, against 4.6 for "same as now". When forty drivers ask at once, a navigator sends all of them to the nearest car park. Look how many find it full. OQIM places them one by one, counting the drivers already sent, and only a few do.

### Слайд 4. 97.4% of spaces right on held-out images (+ своё фото на /parking). Aziza, 2:25 to 3:10

Сначала на слайде:

> The detector, measured on images we did not tune on: 240 PKLot images, 13,447 spaces, 97.4% right.

Komronbek: вкладка /parking, "Choose a photo", выбрать своё фото.

> That is with the spaces outlined. On your own photo nobody marks them: every car it finds is a taken space, and every gap in a row of cars that fits a car is a free one. A wrong one goes with one click. It runs in this browser; the photo is not uploaded.

### Слайд 5. A district: drivers spread over the car parks (живой показ /city). Aziza, 3:10 to 3:55

Сначала на слайде:

> One district at scale: Kwun Tong in Hong Kong. The government publishes its traffic cameras and the free spaces of its car parks, live; we use the 22 cameras within 700 metres. The drivers are simulated; the cameras and the free spaces are real. In this snapshot, sending everyone to the nearest car park put 60 drivers in front of a full one. With OQIM it was 5, and door to door took 18% less time.

Komronbek: вкладка /city, прокрутить вниз к стене камер.

> The free spaces on the live page are read live, so its numbers differ. Here are all the cameras, with what the detector counted on our snapshots of 11 October.

### Слайд 6. From a camera frame to advice. Komronbek, 3:55 to 4:25

> One pipeline for every page. A camera frame. The detector finds cars, buses and trucks, also on small tiles, so the far rows are seen. Each space is free or taken, and it changes only when two frames agree. Then the forecast, then the advice. On your own photo or video it runs in this browser; the tracker frames and the Hong Kong cameras we counted beforehand with a larger model. No GPU server, no plates or faces read.

### Слайд 7. Budget and ROI. Amal, 4:25 to 5:05

> All numbers here are our assumptions, to check with the customer. A three month pilot with one car park operator, on cameras it already has. The main cost is people, three engineers part time. Hosting is free to 20 dollars a month. No sensors in the ground: one camera covers the spaces it sees. We price per camera per month, set in the pilot. Value for the operator: extra spaces filled times hours times the tariff. We will state payback from the pilot, not before.

### Слайд 8. Why it is hard to copy (+ живой показ /banner). Komronbek, 5:05 to 5:50

> Four reasons. A forecast for the minute you arrive, from a live camera count, not only history. Drivers spread, not herded. Ordinary cameras and a browser tab, no sensor per space. And more products from the same cameras: this traffic light reader, and one we built today:

Вкладка /banner, где пример уже посчитан. Нажать Play.

> a billboard counter. Each vehicle crossing the line in front of the billboard is counted once, by type and direction, and turns green, so the count can be checked by eye. Against our heavier offline pipeline: 130 against 130 vehicles at midday, 55 against 59 at dusk.

### Слайд 9. The same cameras can later time the lights. Aziza, 5:50 to 6:15

> Next: traffic lights. From one junction video we read the lights and every vehicle, and test signal plans on a replay. The textbook Webster plan lost to today's timing on all four clips. Knowing the next 30 seconds of arrivals, from a camera upstream, our predictive mode cut one clip's wait from 10.0 to 8.7 seconds.

### Слайд 10. A green wave in 3D, and road damage on a map. Aziza, 6:15 to 6:30

> Later, a green wave on five junctions of Amir Temur Avenue, in a simulation, and a road damage map from phone photos.

### Слайд 11. Team PariVision. Amal, 6:30 to 7:00

> We are Amal, Komronbek and Aziza. Next: a three month pilot with one car park operator in Tashkent, on its own cameras; a live camera instead of a recorded morning; and our own night test set. Everything is live at oqim-audit.vercel.app and the code is on GitHub. Thank you, we are ready for questions.

## Вопросы (3:00)

Отвечать коротко: 2 or 3 предложения и одна цифра. Запасных слайдов в сданной презентации нет, поэтому при необходимости открываем страницу сайта (указана в скобках) или /method, где все правила и цифры.

**1. How accurate is it, and how did you measure it?** (слайд 4, /parking)
Against hand labels, not against ourselves. On 240 PKLot images we did not tune on, 97.4% of 13,447 spaces are right, precision 99.1%, recall 95.3%. On the tracker frames, 98.8% of 6,844 readings.
*По-русски: меряли по ручной разметке; 97,4% на картинках, на которых ничего не подбирали.*

**2. Which numbers are real and which are simulated?**
Real: PKLot frames and hand labels, the Hong Kong cameras and car park vacancy, the organisers' junction videos. Simulated: the drivers on /city, the drive and walk times on /tracker, the replay of signal plans, the green wave. Every page says which is which.
*Реальные: кадры, разметка, камеры. Смоделированы: водители и их маршруты, время в пути, зелёная волна.*

**3. Each car park was recorded on a different day. Isn't the tracker a fake?**
The frames and labels are real. We play three recorded mornings on one clock, and the page says so. The counts were computed from those frames before; the forecast and the advice run live in the page.
*Кадры настоящие, мы только запускаем три утра на одних часах, и это написано на странице.*

**4. How do you find the spaces nobody labelled?**
A space is wherever a vehicle stays in one place for 20 minutes. On the labelled part the same method finds 139 of the 142 spaces that cars used. A space nobody parked in that morning cannot be found this way.

**5. And from one photo?** (/parking)
Every car is a taken space, and a gap in a row of cars that fits a car is a free one. On 336 PKLot images, 88% of taken spaces are found. Of the suggested free spaces that land on a labelled space, 84% are free, but only 12% of the free spaces are found: a free space with no car beside it cannot be seen in one photo, so you click it in. Those settings were picked on the same images, so it is not a held-out number.
*Честно: настройки подобраны на тех же картинках.*

**6. How does the forecast work?**
Spaces taken now plus the trend: half from the last 20 minutes, half from the same car park's usual weekday morning. Checked against the hand labels of the frame ten minutes later: 3.0 spaces off, against 4.6 for "same as now".

**7. How exact is the billboard count?** (/banner)
In the browser it counted 130 vehicles against 130 from our heavier offline pipeline at midday, and 55 against 59 at dusk. That is two models agreeing on the total, not a hand count. For a client report a person watches the replay: each counted car turns green, and a missed one is added with one click. The log keeps how many corrections were needed.
*Это совпадение двух моделей, а не ручной подсчёт; для отчёта человек проверяет и правит кнопками.*

**8. What about night and rain?**
PKLot has rain and cloud: rainy frames 96.1%, cloudy 99.0%, sunny 97.0%. It has no night frames, so night is not measured; our own night test set is on the list. The billboard count drops at dusk: 55 against 59 from our offline pipeline.

**9. Privacy?**
The detector runs in the browser on the visitor's machine; the video or photo is not uploaded. We look only for vehicles, we do not read number plates or faces, and from a visitor's video or photo we keep only the counts. The camera images on the site are public open data.
*Видео никуда не загружается, номера и лица не читаем.*

**10. Does it need a GPU server? What does it cost?** (слайд 7)
No. The detector is a 10 MB or 38 MB model that runs in the browser, so the site is static files plus two small proxies for the open data, hosted free to about 20 dollars a month. A car park needs one frame every few minutes from a camera it already has; the tracker was measured on one every 5 minutes.

**11. Why not sensors in each space?**
A sensor costs money for every space and has to be put into the ground. One camera covers a whole car park, and many car parks already have one.

**12. How does it scale to Tashkent?** (/elsewhere)
Tashkent started paid street parking in May 2025 and plans 13,208 spaces on 86 streets. The city is also connecting its junctions to a control centre: 125 of about 1,000 so far, 545 planned for 2026. The same cameras serve parking, billboards and, later, the lights.

**13. What did you reuse from the elimination?** (README)
The in-browser detector, the ONNX worker, the ByteTrack port, the video conversion with ffmpeg.wasm and the site design come from our elimination system, and the README says so. Built in the final: the parking tracker, the forecast, the advice, the whole car park method, the photo suggestion, the billboard counter, the district model and the signal audit.

**14. Who is your customer, and who pays?** (слайд 7)
Car park operators of malls, business centres and hospitals, who want full spaces and no queue at the gate; the city, for less searching traffic; outdoor advertising companies for the billboard counts. First a three month pilot on one operator's cameras. Prices are our assumptions until the pilot.

**15. What is your competitive advantage?** (слайд 8)
Others put a sensor in every space, or predict from history, as Parkopedia does. We forecast the minute you arrive from a live count by cameras the car park already has, and spread drivers so they do not all go to the same car park. And it runs in a browser, with no server to buy.

**16. Why Hong Kong and Curitiba, not Tashkent?**
We needed open, legal data: Hong Kong publishes its cameras and car park vacancy, and PKLot is a public dataset with hand labels. Tashkent's parking cameras are not public yet; that is what the pilot is for.

**17. What happens if the camera moves or is blocked?**
The spaces are tied to the camera's view, so a moved camera needs its spaces found again; with the "where cars stay" method that takes one busy morning. A blocked view would show up as a sudden drop in cars; flagging it automatically is not built yet.

**18. What was the hardest part?**
Small cars in the far rows. On the whole frame alone the detector found only 46% of the taken spaces; running it also on 3 x 3 overlapping tiles raised that to 96%. For the far rows of a whole car park we add a second pass on 5 x 5 tiles over the top of the frame, each enlarged.

Если не знаем ответа: "We have not measured that yet. It is on our list for the pilot." Не придумывать цифры.

## Если что-то сломалось

- Страница не грузится: показать картинку на слайде и назвать адрес страницы.
- Детектор долго качается: модель на /parking 10 MB, на /banner 38 MB; поэтому всё открыто заранее.
- Время выходит: сократить слайды 9 и 10 до одной фразы и сразу перейти к слайду 11.
