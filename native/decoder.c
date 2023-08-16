#include <stdio.h>
#include "decoder.h"
#include "libavcodec/avcodec.h"
#include "libavutil/imgutils.h"

AVCodecContext * create_codec_context() {
    const AVCodec *codec = avcodec_find_decoder(AV_CODEC_ID_H264);
    AVCodecContext *ctx = avcodec_alloc_context3(codec);
    if (avcodec_open2(ctx, codec, NULL) < 0) {
        avcodec_free_context(&ctx);
        return 0;
    }

    return ctx;
}

void destroy_codec_context(AVCodecContext *ctx) {
    avcodec_free_context(&ctx);
}

void close_frame(AVFrame *frame) {
    av_frame_free(&frame);
}

AVFrame * decode(AVCodecContext *ctx,
       uint8_t *data_in,
       int data_in_size,
       uint8_t **y_plane_out,
       uint8_t **u_plane_out,
       uint8_t **v_plane_out,
       int *width_out,
       int *height_out,
       int *stride_out,
       unsigned long *timestamp_out,
       int *is_key_frame
) {
    int ret;

    AVPacket *avpkt = av_packet_alloc();

    AVDictionary *dict = NULL;
    if (av_packet_unpack_dictionary(data_in, data_in_size, &dict) >= 0) {
      AVDictionaryEntry *dataEntry = av_dict_get(dict, "d", NULL, 0);
      if (dataEntry) {
        avpkt->data = (uint8_t*)dataEntry->value;
      }
      AVDictionaryEntry *sizeEntry = av_dict_get(dict, "s", NULL, 0);
      if (sizeEntry) {
        avpkt->size = atoi(sizeEntry->value);
      }
      AVDictionaryEntry *timeEntry = av_dict_get(dict, "t", NULL, 0);
      if (timeEntry) {
        *timestamp_out = strtoul(timeEntry->value, NULL, 10);
      }
      
      av_dict_free(&dict);
    }

    ret = avcodec_send_packet(ctx, avpkt);
    if (ret != 0) {
		av_packet_free(&avpkt);
        return NULL;
    }

    AVFrame *frame = av_frame_alloc();
    ret = avcodec_receive_frame(ctx, frame);
    if (ret != 0) {
		av_packet_free(&avpkt);
        av_frame_free(&frame);
        return NULL;
    }

    *y_plane_out = frame->data[0];
    *u_plane_out = frame->data[1];
    *v_plane_out = frame->data[2];
    *stride_out = frame->linesize[0];
    *width_out = frame->width;
    *height_out = frame->height;
    *is_key_frame = frame->key_frame;
	
	av_packet_free(&avpkt);

    return frame;
}
